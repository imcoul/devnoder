// SubscriptionService.ts — tiers, feature gates, $0 start
export type Tier = 'free' | 'pro' | 'team';

export interface Plan {
  id: Tier;
  name: string;
  price: string;
  priceMonthly: number;  // USD
  features: string[];
  limits: Record<string, number | string>;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0 / forever',
    priceMonthly: 0,
    features: [
      'Offline PWA IDE — full editor',
      'CodeMirror 6 + 20 languages',
      'GrapesJS visual editor',
      'WASM terminal (JS/Python/PHP)',
      'isomorphic-git + GitHub sync',
      'Local AI (Qwen 0.5B / 1.5B)',
      '3 Groq API models (free tier)',
      'Community themes & plugins',
      'English + French + Arabic UI',
      '8 accessibility themes',
    ],
    limits: {
      aiMessagesPerDay: 50,
      snippets: 50,
      collaborators: 1,
      deployments: 5,
      computeCredits: 0,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$5 / month',
    priceMonthly: 5,
    features: [
      'Everything in Free',
      'Unlimited AI messages',
      'All 13 AI models (GPT-4o, Claude, etc.)',
      'Cloudflare Tunnel sharing',
      'Unlimited deployments',
      'Priority cloud execution',
      '500 compute credits / month',
      'Snippet sync across devices',
      'AI code review & test generation',
      'Export fine-tune datasets',
    ],
    limits: {
      aiMessagesPerDay: Infinity,
      snippets: Infinity,
      collaborators: 5,
      deployments: Infinity,
      computeCredits: 500,
    },
  },
  {
    id: 'team',
    name: 'Team',
    price: '$12 / seat / month',
    priceMonthly: 12,
    features: [
      'Everything in Pro',
      'Unlimited collaborators',
      'Shared snippet library',
      'Team theme registry',
      'Private plugin registry',
      'SSO (coming soon)',
      'Priority support',
      '2000 compute credits / seat / month',
      'Usage analytics dashboard',
      'Custom domain deployments',
    ],
    limits: {
      aiMessagesPerDay: Infinity,
      snippets: Infinity,
      collaborators: Infinity,
      deployments: Infinity,
      computeCredits: 2000,
    },
  },
];

class SubscriptionService {
  private tier: Tier = 'free';
  private expiresAt: number | null = null;

  load() {
    try {
      const stored = JSON.parse(localStorage.getItem('devnoder-subscription') ?? '{}');
      this.tier = stored.tier ?? 'free';
      this.expiresAt = stored.expiresAt ?? null;
      if (this.expiresAt && Date.now() > this.expiresAt) this.tier = 'free';
    } catch { this.tier = 'free'; }
  }

  getTier(): Tier { return this.tier; }
  getPlan(): Plan { return PLANS.find(p => p.id === this.tier) ?? PLANS[0]; }
  isPro(): boolean { return this.tier === 'pro' || this.tier === 'team'; }
  isTeam(): boolean { return this.tier === 'team'; }

  // Feature gates
  canUseModel(modelId: string): boolean {
    const cloudModels = ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4-6', 'claude-3-5-haiku-20241022'];
    if (cloudModels.some(m => modelId.includes(m.split('-')[0]))) return this.isPro();
    return true;
  }

  canSendAIMessage(todayCount: number): boolean {
    const limit = this.getPlan().limits.aiMessagesPerDay as number;
    return limit === Infinity || todayCount < limit;
  }

  canCollaborate(currentPeerCount: number): boolean {
    const limit = this.getPlan().limits.collaborators as number;
    return limit === Infinity || currentPeerCount < limit;
  }

  /** Activate via a license key (validated server-side in prod) */
  async activateLicense(key: string): Promise<{ success: boolean; tier: Tier; message: string }> {
    // Mock validation — in prod: POST to Cloudflare Worker → D1
    if (key.startsWith('PRO-') && key.length === 20) {
      this.tier = 'pro';
      this.expiresAt = Date.now() + 365 * 86400000;
      localStorage.setItem('devnoder-subscription', JSON.stringify({ tier: 'pro', expiresAt: this.expiresAt, key }));
      return { success: true, tier: 'pro', message: 'Pro activated! Enjoy unlimited AI + all features.' };
    }
    if (key.startsWith('TEAM-') && key.length === 21) {
      this.tier = 'team';
      this.expiresAt = Date.now() + 365 * 86400000;
      localStorage.setItem('devnoder-subscription', JSON.stringify({ tier: 'team', expiresAt: this.expiresAt, key }));
      return { success: true, tier: 'team', message: 'Team plan activated!' };
    }
    return { success: false, tier: 'free', message: 'Invalid license key.' };
  }

  deactivate() {
    this.tier = 'free'; this.expiresAt = null;
    localStorage.removeItem('devnoder-subscription');
  }

  daysRemaining(): number | null {
    if (!this.expiresAt) return null;
    return Math.max(0, Math.ceil((this.expiresAt - Date.now()) / 86400000));
  }
}

export const subscriptionService = new SubscriptionService();
