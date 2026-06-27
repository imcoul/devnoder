// ── Cloud Tier Service ────────────────────────────────────────
// Manages DevNoder hosted tier subscriptions.
// Free tier = full AGPL core, no limits.
// Hosted tier = cloud sync, team management, priority AI, SLA.
// Billing via Stripe (client-side only — no secrets in browser).

import { atom } from 'nanostores'
import { getSetting, setSetting } from '../storage/db'

// ── Types ─────────────────────────────────────────────────────

export type TierName = 'free' | 'hosted' | 'team' | 'enterprise'

export interface Subscription {
  tier:        TierName
  seats:       number
  status:      'active' | 'trialing' | 'past_due' | 'canceled' | 'none'
  currentPeriodEnd?: Date
  cancelAtPeriodEnd: boolean
  teamId?:     string
  customerId?: string
}

export interface TierFeature {
  id:          string
  label:       string
  free:        boolean | string
  hosted:      boolean | string
  team:        boolean | string
  [key: string]: boolean | string
}

// ── Tier features matrix ──────────────────────────────────────

export const TIER_FEATURES: TierFeature[] = [
  { id: 'core',       label: 'Full AGPL core IDE',              free: true,         hosted: true,          team: true },
  { id: 'offline',    label: 'Offline-first PWA',               free: true,         hosted: true,          team: true },
  { id: 'ai_local',   label: 'Local AI (on-device)',            free: true,         hosted: true,          team: true },
  { id: 'git',        label: 'Git & GitHub integration',        free: true,         hosted: true,          team: true },
  { id: 'collab',     label: 'Real-time collaboration',         free: '2 users',    hosted: '5 users',     team: 'Unlimited' },
  { id: 'ai_cloud',   label: 'Cloud AI (bring your key)',       free: true,         hosted: true,          team: true },
  { id: 'ai_credits', label: 'Managed AI credits',             free: false,        hosted: '$5 included', team: '$20 included' },
  { id: 'sync',       label: 'Cloud project sync',              free: false,        hosted: '10 projects', team: 'Unlimited' },
  { id: 'pool',       label: 'Compute pool credits',            free: 'earn only',  hosted: '500/mo',      team: '2000/mo' },
  { id: 'support',    label: 'Priority support',                free: false,        hosted: 'Email',       team: 'Slack + SLA' },
  { id: 'plugins',    label: 'Private plugin registry',         free: false,        hosted: false,         team: true },
  { id: 'sso',        label: 'SSO / SAML',                      free: false,        hosted: false,         team: true },
]

export const TIER_PRICES = {
  hosted:     { monthly: 5,  annual: 48,  unit: 'per user/mo'  },
  team:       { monthly: 10, annual: 96,  unit: 'per user/mo'  },
  enterprise: { monthly: 0,  annual: 0,   unit: 'contact us'   },
}

// ── Store ─────────────────────────────────────────────────────

export const $subscription = atom<Subscription>({
  tier: 'free', seats: 1, status: 'none', cancelAtPeriodEnd: false,
})

// ── Load subscription ─────────────────────────────────────────

export async function loadSubscription(): Promise<void> {
  const cached = await getSetting('subscription') as Subscription | undefined
  if (cached) {
    $subscription.set(cached)
    return
  }

  const token = await getSetting('billing.token') as string | undefined
  if (!token || !navigator.onLine) return

  try {
    const res = await fetch('https://devnoder-executor.srvel-build.workers.dev/billing/subscription', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!res.ok) return
    const data = await res.json() as any
    const sub: Subscription = {
      tier:              data.tier ?? 'free',
      seats:             data.seats ?? 1,
      status:            data.status ?? 'none',
      currentPeriodEnd:  data.currentPeriodEnd ? new Date(data.currentPeriodEnd) : undefined,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
      teamId:            data.teamId,
      customerId:        data.customerId,
    }
    $subscription.set(sub)
    await setSetting('subscription', sub)
  } catch { /* offline — use cached */ }
}

// ── Feature gating ────────────────────────────────────────────

export function hasFeature(featureId: string): boolean {
  const sub     = $subscription.get()
  const feature = TIER_FEATURES.find(f => f.id === featureId)
  if (!feature) return true   // unknown features are allowed

  const value = feature[sub.tier] ?? feature.free
  return value !== false && value !== 'false'
}

export function getFeatureValue(featureId: string): string | boolean {
  const sub     = $subscription.get()
  const feature = TIER_FEATURES.find(f => f.id === featureId)
  if (!feature) return true
  return feature[sub.tier] ?? feature.free
}

export function isHosted(): boolean {
  return $subscription.get().tier !== 'free'
}

// ── Stripe checkout ───────────────────────────────────────────

const STRIPE_PUBLISHABLE_KEY = 'pk_live_REPLACE_WITH_STRIPE_KEY'
const CHECKOUT_WORKER        = 'https://devnoder-executor.srvel-build.workers.dev/billing'

export async function startCheckout(tier: 'hosted' | 'team', seats = 1): Promise<void> {
  if (!navigator.onLine) throw new Error('Internet required to subscribe')

  const res = await fetch(`${CHECKOUT_WORKER}/create-checkout`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tier, seats,
      successUrl: `${window.location.origin}?billing=success`,
      cancelUrl:  `${window.location.origin}?billing=cancel`,
    }),
  })

  if (!res.ok) throw new Error('Failed to create checkout session')
  const { url } = await res.json() as { url: string }
  window.open(url, '_blank')
}

export async function openCustomerPortal(): Promise<void> {
  const token = await getSetting('billing.token') as string | undefined
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(`${CHECKOUT_WORKER}/portal`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnUrl: window.location.origin }),
  })

  if (!res.ok) throw new Error('Failed to open billing portal')
  const { url } = await res.json() as { url: string }
  window.open(url, '_blank')
}

// ── Handle billing callback (on app load) ────────────────────

export async function handleBillingCallback(): Promise<'success' | 'cancel' | null> {
  const params = new URLSearchParams(window.location.search)
  const billing = params.get('billing')
  if (!billing) return null

  // Clean up URL
  window.history.replaceState({}, '', window.location.pathname)

  if (billing === 'success') {
    // Re-fetch subscription after successful checkout
    await getSetting('subscription').then(() => setSetting('subscription', null as any))
    await loadSubscription()
    return 'success'
  }
  return 'cancel'
}
