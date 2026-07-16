import type { SubscriptionPlan } from '@/types';

/** Long-form feature explanations shown when a plan is expanded on the paywall. */
export const FEATURE_DETAILS: Record<string, string> = {
  'Browse markets': 'Full access to every live Polymarket and Kalshi market, updated continuously.',
  'Daily briefing': 'A ranked morning digest of the markets that moved and why they matter.',
  'Limited AI analysis': '3 AI market analyses per day — summary, bull/bear cases, catalysts, and risks.',
  'More AI reports': '25 AI analyses per day, with results cached so repeat views are instant.',
  'Personalized feed': 'Your briefing is re-ranked around the categories you follow and your experience level.',
  'Alerts': 'Push notifications when a watched market moves sharply, including premium AI-shift alerts explaining the move.',
  'Watchlists': 'Track up to 50 markets, synced to your account across devices.',
  'Unlimited AI analysis': 'No daily cap — analyze any market, any time.',
  'Advanced insights': 'Deeper AI runs: probability estimates vs. market pricing, cross-platform spread flags.',
  'Future premium tools': 'Early access to new Trader-tier features as they ship (news ingestion, custom alert rules).',
};

export const PLANS: SubscriptionPlan[] = [
  {
    tier: 'free',
    name: 'Free',
    priceLabel: '$0',
    features: ['Browse markets', 'Daily briefing', 'Limited AI analysis'],
  },
  {
    tier: 'pro',
    name: 'Pro',
    priceLabel: '$19.99/mo',
    features: ['More AI reports', 'Personalized feed', 'Alerts', 'Watchlists'],
  },
  {
    tier: 'trader',
    name: 'Trader',
    priceLabel: '$99/mo',
    features: ['Unlimited AI analysis', 'Advanced insights', 'Future premium tools'],
  },
];

// RevenueCat entitlement identifiers (configured in the RevenueCat dashboard).
export const RC_ENTITLEMENTS: Record<Exclude<SubscriptionPlan['tier'], 'free'>, string> = {
  pro: 'signal_pro',
  trader: 'signal_trader',
};
