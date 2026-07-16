import type { PlanTier } from '@/types';

/** Feature limits per plan. `Infinity` = unlimited. */
export interface Entitlements {
  tier: PlanTier;
  dailyAiAnalyses: number;
  watchlistLimit: number;
  alertsEnabled: boolean;
  personalizedFeed: boolean;
  advancedInsights: boolean;
}

const TABLE: Record<PlanTier, Omit<Entitlements, 'tier'>> = {
  free: {
    dailyAiAnalyses: 3,
    watchlistLimit: 5,
    alertsEnabled: false,
    personalizedFeed: false,
    advancedInsights: false,
  },
  pro: {
    dailyAiAnalyses: 25,
    watchlistLimit: 50,
    alertsEnabled: true,
    personalizedFeed: true,
    advancedInsights: false,
  },
  trader: {
    dailyAiAnalyses: Infinity,
    watchlistLimit: Infinity,
    alertsEnabled: true,
    personalizedFeed: true,
    advancedInsights: true,
  },
};

export function entitlementsFor(tier: PlanTier): Entitlements {
  return { tier, ...TABLE[tier] };
}

/** Minimum tier that unlocks a given capability, for paywall CTAs. */
export function requiredTierFor(feature: keyof Omit<Entitlements, 'tier'>): PlanTier {
  const order: PlanTier[] = ['free', 'pro', 'trader'];
  for (const t of order) {
    const e = TABLE[t][feature];
    if (e === true || e === Infinity) return t;
  }
  return 'trader';
}
