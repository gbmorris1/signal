import type { Category, ExperienceLevel, Market } from '@/types';

/**
 * Recommendation scoring. Ranks markets for a user's Home feed by blending:
 *  - interest match (category in the user's selected interests)
 *  - AI score (model conviction)
 *  - recent movement (|24h change|)
 *  - liquidity (volume), lightly
 *
 * Experience level tilts the weighting: beginners see higher-conviction,
 * higher-liquidity markets; professionals see more of the sharp movers.
 */
export interface RecommendationInput {
  markets: Market[];
  interests: Category[];
  experience: ExperienceLevel;
}

const WEIGHTS: Record<ExperienceLevel, { ai: number; move: number; volume: number }> = {
  beginner: { ai: 0.5, move: 0.2, volume: 0.3 },
  active: { ai: 0.4, move: 0.4, volume: 0.2 },
  professional: { ai: 0.3, move: 0.55, volume: 0.15 },
};

export function scoreMarket(
  market: Market,
  interests: Category[],
  experience: ExperienceLevel,
): number {
  const w = WEIGHTS[experience];
  const interestBoost = interests.length === 0 || interests.includes(market.category) ? 1 : 0.35;
  const ai = (market.aiScore ?? 40) / 100;
  const move = Math.min(1, Math.abs(market.change24h) / 0.15);
  const volume = Math.min(1, market.volume / 10_000_000);
  const base = w.ai * ai + w.move * move + w.volume * volume;
  return base * interestBoost;
}

export function recommendFeed({ markets, interests, experience }: RecommendationInput): Market[] {
  return [...markets]
    .map((m) => ({ m, s: scoreMarket(m, interests, experience) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
}
