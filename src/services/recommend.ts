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

export interface RankedMarket {
  market: Market;
  /** Short human-readable reason this market surfaced, e.g. "Moved +8% · your interest: Finance". */
  reason: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  politics: 'Politics',
  finance: 'Finance',
  crypto: 'Crypto',
  sports: 'Sports',
  world: 'World',
  technology: 'Technology',
};

/** Why did this market make the briefing? Lead with the strongest factor. */
export function explainPick(market: Market, interests: Category[]): string {
  const parts: string[] = [];
  const movePts = Math.round(market.change24h * 100);
  if (Math.abs(movePts) >= 3) parts.push(`Moved ${movePts > 0 ? '+' : ''}${movePts}% today`);
  if (interests.includes(market.category)) {
    parts.push(`your interest: ${CATEGORY_LABEL[market.category] ?? market.category}`);
  }
  if (parts.length === 0) {
    if (Math.abs(market.probability - 0.5) < 0.12) parts.push('Genuinely contested odds');
    else if (market.volume > 1_000_000) parts.push('Heavy trading volume');
    else parts.push('High signal score');
  }
  return parts.join(' · ');
}

/** Ranked briefing with per-pick reasons, for the Home feed. */
export function recommendFeedDetailed(input: RecommendationInput): RankedMarket[] {
  return recommendFeed(input).map((market) => ({
    market,
    reason: explainPick(market, input.interests),
  }));
}
