import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}));

vi.mock('../storage/db', () => ({ getSetting: mocks.getSetting, setSetting: mocks.setSetting }));

import { $subscription, loadSubscription, startCheckout, openCustomerPortal } from './CloudTier';

describe('CloudTier billing safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSetting.mockResolvedValue(JSON.stringify({ tier: 'team', status: 'active' }));
  });

  it('resets forged local entitlements to free and removes the stale cache', async () => {
    $subscription.set({ tier: 'team', seats: 4, status: 'active', cancelAtPeriodEnd: false });
    await loadSubscription();

    expect($subscription.get()).toEqual({ tier: 'free', seats: 1, status: 'none', cancelAtPeriodEnd: false });
    expect(mocks.setSetting).toHaveBeenCalledWith('subscription', '');
  });

  it('rejects checkout and portal requests locally without sending network requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(startCheckout('team', 2)).rejects.toThrow('Billing and checkout are not configured');
    await expect(openCustomerPortal()).rejects.toThrow('Customer billing portal is not configured');
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
