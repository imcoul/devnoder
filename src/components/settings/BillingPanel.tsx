import { useState, useEffect } from 'react'
import { useStore } from '@nanostores/react'
import {
  $subscription, TIER_FEATURES, TIER_PRICES,
  loadSubscription, startCheckout, openCustomerPortal,
  isHosted,
} from '../../services/cloud/CloudTier'
import { showToast } from '../../stores/ui'
import './BillingPanel.css'

function FeatureRow({ label, free, hosted, team }: { label: string; free: any; hosted: any; team: any }) {
  const fmt = (v: any) => v === true ? '✓' : v === false ? '—' : v
  const col = (v: any) => v === false ? 'billing-feat__no' : 'billing-feat__yes'
  return (
    <div className="billing-feat">
      <span className="billing-feat__label">{label}</span>
      <span className={col(free)}>{fmt(free)}</span>
      <span className={col(hosted)}>{fmt(hosted)}</span>
      <span className={col(team)}>{fmt(team)}</span>
    </div>
  )
}

export default function BillingPanel() {
  const sub      = useStore($subscription)
  const [loading, setLoading] = useState<string | null>(null)
  const [seats,   setSeats]   = useState(1)

  useEffect(() => { loadSubscription() }, [])

  const checkout = async (tier: 'hosted' | 'team') => {
    setLoading(tier)
    try {
      await startCheckout(tier, seats)
    } catch (e: any) {
      showToast({ type: 'error', message: e.message })
    } finally { setLoading(null) }
  }

  const portal = async () => {
    setLoading('portal')
    try { await openCustomerPortal() }
    catch (e: any) { showToast({ type: 'error', message: e.message }) }
    finally { setLoading(null) }
  }

  return (
    <div className="billing-panel">
      {/* Current plan */}
      <div className="billing-current">
        <div className="billing-current__info">
          <span className="billing-current__tier">{sub.tier.charAt(0).toUpperCase() + sub.tier.slice(1)}</span>
          {sub.status === 'active' && <span className="billing-current__badge billing-current__badge--active">Active</span>}
          {sub.status === 'trialing' && <span className="billing-current__badge billing-current__badge--trial">Trial</span>}
          {sub.status === 'past_due' && <span className="billing-current__badge billing-current__badge--warn">Past due</span>}
          {sub.currentPeriodEnd && (
            <span className="billing-current__date">Renews {sub.currentPeriodEnd.toLocaleDateString()}</span>
          )}
        </div>
        {isHosted() && (
          <button className="billing-manage-btn" onClick={portal} disabled={loading === 'portal'}>
            {loading === 'portal' ? '…' : 'Manage Plan'}
          </button>
        )}
      </div>

      {/* Pricing cards */}
      {!isHosted() && (
        <div className="billing-plans">
          {/* Free */}
          <div className="billing-plan billing-plan--current">
            <div className="billing-plan__header">
              <span className="billing-plan__name">Free</span>
              <span className="billing-plan__price">$0</span>
              <span className="billing-plan__unit">forever</span>
            </div>
            <p className="billing-plan__desc">Full AGPL core. No limits, no time bomb.</p>
            <div className="billing-plan__cta billing-plan__cta--current">Current plan</div>
          </div>

          {/* Hosted */}
          <div className="billing-plan billing-plan--featured">
            <div className="billing-plan__badge">Most popular</div>
            <div className="billing-plan__header">
              <span className="billing-plan__name">Hosted</span>
              <span className="billing-plan__price">${TIER_PRICES.hosted.monthly}</span>
              <span className="billing-plan__unit">{TIER_PRICES.hosted.unit}</span>
            </div>
            <p className="billing-plan__desc">Cloud sync, managed AI credits, priority support.</p>
            <div className="billing-plan__seats">
              <label className="billing-seats__label">Seats</label>
              <div className="billing-seats__control">
                <button onClick={() => setSeats(s => Math.max(1, s - 1))} className="billing-seats__btn">−</button>
                <span className="billing-seats__count">{seats}</span>
                <button onClick={() => setSeats(s => Math.min(50, s + 1))} className="billing-seats__btn">+</button>
              </div>
              <span className="billing-seats__total">${TIER_PRICES.hosted.monthly * seats}/mo</span>
            </div>
            <button
              className="billing-plan__cta billing-plan__cta--primary"
              onClick={() => checkout('hosted')}
              disabled={loading === 'hosted'}
            >
              {loading === 'hosted' ? 'Opening…' : 'Start free trial'}
            </button>
          </div>

          {/* Team */}
          <div className="billing-plan">
            <div className="billing-plan__header">
              <span className="billing-plan__name">Team</span>
              <span className="billing-plan__price">${TIER_PRICES.team.monthly}</span>
              <span className="billing-plan__unit">{TIER_PRICES.team.unit}</span>
            </div>
            <p className="billing-plan__desc">Unlimited collab, private plugins, SSO, Slack SLA.</p>
            <button
              className="billing-plan__cta billing-plan__cta--outline"
              onClick={() => checkout('team')}
              disabled={loading === 'team'}
            >
              {loading === 'team' ? 'Opening…' : 'Upgrade to Team'}
            </button>
          </div>
        </div>
      )}

      {/* Feature comparison */}
      <div className="billing-features">
        <div className="billing-feat billing-feat--header">
          <span />
          <span>Free</span>
          <span className="billing-feat__highlight">Hosted</span>
          <span>Team</span>
        </div>
        {TIER_FEATURES.map(f => (
          <FeatureRow key={f.id} label={f.label} free={f.free} hosted={f.hosted} team={f.team} />
        ))}
      </div>

      {/* AGPL note */}
      <p className="billing-agpl-note">
        DevNoder is AGPL-3.0. The core will always be free and open source.
        Paid plans fund development and infrastructure. {' '}
        <a href="https://github.com/srvel-build/devnoder" target="_blank" rel="noopener noreferrer">View source →</a>
      </p>
    </div>
  )
}
