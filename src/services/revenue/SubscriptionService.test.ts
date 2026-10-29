import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subscriptionService } from './SubscriptionService';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
  };
}

describe('SubscriptionService', () => {
  beforeEach(() => vi.stubGlobal('localStorage', createStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('discards a client-edited paid tier instead of treating it as a verified entitlement', () => {
    localStorage.setItem('devnoder-subscription', JSON.stringify({ tier: 'team', expiresAt: Date.now() + 86_400_000 }));
    subscriptionService.load();

    expect(subscriptionService.getTier()).toBe('free');
    expect(subscriptionService.getPlan().id).toBe('free');
    expect(subscriptionService.isPro()).toBe(false);
    expect(subscriptionService.isTeam()).toBe(false);
    expect(localStorage.getItem('devnoder-subscription')).toBeNull();
  });

  it('does not activate a locally formatted or fabricated license key', async () => {
    const result = await subscriptionService.activateLicense('PRO-1234567890123456');

    expect(result).toEqual({ success: false, tier: 'free', message: 'Paid license activation is not available in this release.' });
    expect(subscriptionService.getTier()).toBe('free');
    expect(localStorage.getItem('devnoder-subscription')).toBeNull();
  });
});
