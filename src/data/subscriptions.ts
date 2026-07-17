import type { SubscriptionPlan } from '@/types';

/**
 * Long-form feature explanations shown when a plan is expanded on the
 * paywall. Every bullet here must be something the server actually enforces
 * (see supabase/functions/analyze-market and sync-markets) — don't sell a
 * capability the app doesn't have yet.
 */
export const FEATURE_DETAILS: Record<string, string> = {
  'Browse markets': 'Full access to every live Polymarket and Kalshi market, updated continuously.',
  'Daily briefing': 'A ranked morning digest of the markets that moved and why they matter.',
  'Limited AI analysis': '1 AI market analysis per day: summary, bull/bear cases, catalysts, and risks.',
  'More AI reports': '25 AI analyses per day, with results cached so repeat views are instant.',
  'Alerts': 'Push notifications when a watched market moves sharply, including premium AI-shift alerts explaining the move.',
  'Bigger watchlist': 'Track up to 50 markets, synced to your account across devices.',
  'Unlimited AI analysis': 'No daily cap. Analyze any market, any time.',
  'Deepest analysis depth': 'The model reads more sources and reasons further before answering — the same depth Free and Pro don’t get.',
  'Unlimited watchlist': 'No cap on how many markets you can track.',
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
    features: ['More AI reports', 'Alerts', 'Bigger watchlist'],
  },
  {
    tier: 'trader',
    name: 'Trader',
    priceLabel: '$99/mo',
    features: ['Unlimited AI analysis', 'Deepest analysis depth', 'Unlimited watchlist'],
  },
];

// RevenueCat entitlement identifiers (configured in the RevenueCat dashboard).
export const RC_ENTITLEMENTS: Record<Exclude<SubscriptionPlan['tier'], 'free'>, string> = {
  pro: 'signal_pro',
  trader: 'signal_trader',
};
