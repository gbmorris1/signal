import type { PlanTier } from '@/types';

export type AiDepth = 'shallow' | 'standard' | 'deep';

/** Feature limits per plan. `Infinity` = unlimited. */
export interface Entitlements {
  tier: PlanTier;
  dailyAiAnalyses: number;
  /** Analysis depth this tier's model calls run at (bounds AI cost). */
  aiDepth: AiDepth;
  watchlistLimit: number;
  alertsEnabled: boolean;
  personalizedFeed: boolean;
  advancedInsights: boolean;
}

const TABLE: Record<PlanTier, Omit<Entitlements, 'tier'>> = {
  free: {
    dailyAiAnalyses: 1,
    aiDepth: 'shallow',
    watchlistLimit: 5,
    alertsEnabled: false,
    personalizedFeed: false,
    advancedInsights: false,
  },
  pro: {
    dailyAiAnalyses: 25,
    aiDepth: 'standard',
    watchlistLimit: 50,
    alertsEnabled: true,
    personalizedFeed: true,
    advancedInsights: false,
  },
  trader: {
    dailyAiAnalyses: Infinity,
    aiDepth: 'deep',
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
