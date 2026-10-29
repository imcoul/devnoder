// SubscriptionService.ts — safe local status only until server-verified billing exists.
export type Tier = 'free' | 'pro' | 'team';

export interface Plan {
  id: Tier;
  name: string;
  price: string;
  priceMonthly: number;
  features: string[];
  limits: Record<string, number | string>;
}

/** This is the only entitlement currently available in the product. */
export const PLANS: Plan[] = [{
  id: 'free',
  name: 'Free local core',
  price: 'No subscription',
  priceMonthly: 0,
  features: [
    'Browser-local project editing',
    'Supported local runtimes and project preview',
    'Local project ZIP export',
    'User-configured GitHub sync',
    'On-device model support varies by browser and device',
  ],
  limits: {
    aiMessagesPerDay: 50,
    snippets: 50,
    collaborators: 1,
    deployments: 0,
    computeCredits: 0,
  },
}];

class SubscriptionService {
  private readonly tier: Tier = 'free';
  private readonly expiresAt: number | null = null;

  /**
   * Paid tiers previously could be restored from editable localStorage. That
   * was not a valid entitlement check; discard those claims until a verified
   * billing service exists.
   */
  load(): void {
    try {
      const stored = JSON.parse(localStorage.getItem('devnoder-subscription') ?? '{}') as { tier?: string };
      if (stored.tier && stored.tier !== 'free') localStorage.removeItem('devnoder-subscription');
    } catch {
      localStorage.removeItem('devnoder-subscription');
    }
  }

  getTier(): Tier { return this.tier; }
  getPlan(): Plan { return PLANS[0]; }
  isPro(): boolean { return false; }
  isTeam(): boolean { return false; }

  canUseModel(_modelId: string): boolean { return true; }
  canSendAIMessage(todayCount: number): boolean { return todayCount < 50; }
  canCollaborate(currentPeerCount: number): boolean { return currentPeerCount < 1; }

  /** Paid license validation is intentionally unavailable; local formats never grant entitlements. */
  async activateLicense(_key: string): Promise<{ success: false; tier: 'free'; message: string }> {
    return { success: false, tier: 'free', message: 'Paid license activation is not available in this release.' };
  }

  deactivate(): void {
    localStorage.removeItem('devnoder-subscription');
  }

  daysRemaining(): number | null { return this.expiresAt; }
}

export const subscriptionService = new SubscriptionService();
