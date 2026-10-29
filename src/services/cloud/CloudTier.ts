// ── Cloud Tier Service ────────────────────────────────────────
// Describes the planned hosted tier matrix; billing is deliberately disabled
// until a server-verified entitlement and checkout service are configured.

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
  // Billing has no configured, signed server entitlement in this deployment.
  // Never restore an editable localStorage/IndexedDB value as a paid plan.
  $subscription.set({ tier: 'free', seats: 1, status: 'none', cancelAtPeriodEnd: false })
  const raw = await getSetting('subscription', '')
  if (raw) {
    try {
      const cached = JSON.parse(raw) as Partial<Subscription>
      if (cached.tier && cached.tier !== 'free') await setSetting('subscription', '')
    } catch {
      await setSetting('subscription', '')
    }
  }
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

export async function startCheckout(tier: 'hosted' | 'team', seats = 1): Promise<void> {
  void tier;
  void seats;
  throw new Error('Billing and checkout are not configured in this release.')
}

export async function openCustomerPortal(): Promise<void> {
  throw new Error('Customer billing portal is not configured in this release.')
}

// ── Handle billing callback (on app load) ────────────────────

export async function handleBillingCallback(): Promise<'success' | 'cancel' | null> {
  const params = new URLSearchParams(window.location.search)
  const billing = params.get('billing')
  if (!billing) return null

  // Clean up URL
  window.history.replaceState({}, '', window.location.pathname)

  if (billing === 'success') {
    await setSetting('subscription', '')
    await loadSubscription()
  }
  return null
}
