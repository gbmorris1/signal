import type { SubscriptionPlan } from '@/types';

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
