import type { Category, Market, MarketHistory, MarketDataSource } from '@/types';

/**
 * Merges multiple platform sources behind the single MarketDataSource
 * interface. Lists run in parallel; a failing platform degrades to its own
 * fallback (or []) without breaking the others.
 */
export class CombinedSource implements MarketDataSource {
  readonly platform = 'mock' as const; // aggregate; platform is per-market

  constructor(private sources: MarketDataSource[]) {}

  async listMarkets(params?: { category?: Category; query?: string }): Promise<Market[]> {
    const results = await Promise.allSettled(this.sources.map((s) => s.listMarkets(params)));
    const merged = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    // Interleave platforms by volume so one source doesn't bury the other.
    return merged.sort((a, b) => b.volume - a.volume);
  }

  async getMarket(id: string): Promise<Market | null> {
    // Route by id prefix ("polymarket:", "kalshi:") when possible.
    const owner = this.sources.find((s) => id.startsWith(`${s.platform}:`));
    if (owner) return owner.getMarket(id);
    for (const s of this.sources) {
      const m = await s.getMarket(id);
      if (m) return m;
    }
    return null;
  }

  async getHistory(id: string): Promise<MarketHistory> {
    const owner = this.sources.find((s) => id.startsWith(`${s.platform}:`));
    if (owner) return owner.getHistory(id);
    return this.sources[0]?.getHistory(id) ?? { snapshots: [], synthetic: true };
  }

  /**
   * Cross-platform comparison: find markets on other platforms that appear to
   * be the same question. Same category + keyword overlap, with proper-noun /
   * number matches weighted double (the entities are what identify a question:
   * "Fed", "September", "Trump", "100k"). Returns the best matches first, max 2 -
   * most markets are platform-exclusive, and the UI says so honestly.
   */
  async findComparables(market: Market): Promise<Market[]> {
    const all = await this.listMarkets();
    const keys = titleKeywords(market.title);
    return all
      .filter((m) => m.platform !== market.platform && m.category === market.category)
      .map((m) => ({ m, s: matchStats(keys, titleKeywords(m.title)) }))
      // Was 0.55, which measured at ~8% precision and put another venue's price
      // for a DIFFERENT question — sometimes the complement — on the detail
      // screen as "Platform availability". Now the same strict bar as spreads.
      .filter((x) => isSameQuestionStrict(market, x.m, x.s))
      .sort((a, b) => b.s.minRatio - a.s.minRatio)
      .slice(0, 2)
      .map((x) => x.m);
  }

  // A `findSpreads` scanner and a dedicated /spreads screen used to live here.
  // Both were removed 2026-07-20 after measuring the matcher against the live
  // catalogues: across 183k comparisons exactly ONE genuine cross-venue pair
  // existed, so the screen was permanently empty even at its own threshold —
  // and every relaxation of that threshold produced phantom spreads against
  // different questions. Cross-venue comparison now lives where it is actually
  // useful and self-limiting: the "Platform availability" panel on the market
  // screen, via findComparables above, which shows a second venue only when the
  // question AND its outcome match, and states the different-criteria caveat.
  // Reviving a scanner needs structural matching first — see isSameQuestion.
}

const STOP = new Set([
  'will', 'the', 'a', 'an', 'in', 'by', 'of', 'to', 'on', 'be', 'is', 'at', 'for', 'and', 'or',
  'who', 'what', 'which', 'when', 'how', 'next', 'before', 'after', 'end', 'win', 'winner',
]);

/** Keywords weighted by identifying power: numbers and rare tokens count double. */
export function titleKeywords(title: string): Map<string, number> {
  const out = new Map<string, number>();
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
  for (const w of words) {
    // Numbers, years, and long distinctive tokens are the identifying entities.
    const weight = /\d/.test(w) || w.length >= 6 ? 2 : 1;
    out.set(w, Math.max(out.get(w) ?? 0, weight));
  }
  return out;
}

export interface MatchStats {
  /** Count of shared tokens (distinct words present on both sides). */
  shared: number;
  /** Count of shared tokens that are distinctive (proper nouns / numbers). */
  sharedDistinct: number;
  /** Two-way overlap: shared weight over the LARGER side's total. Bounded 0..1. */
  minRatio: number;
}

/**
 * Symmetric title match. Unlike a one-sided overlap, `minRatio` divides by the
 * larger title so a short question can't "match" a broad one just by sharing a
 * single token (the bug where a Mamdani mayoral market paired with a national
 * "Democratic president" market).
 */
export function matchStats(a: Map<string, number>, b: Map<string, number>): MatchStats {
  if (a.size === 0 || b.size === 0) return { shared: 0, sharedDistinct: 0, minRatio: 0 };
  let shared = 0;
  let sharedDistinct = 0;
  let sharedWt = 0;
  for (const [w, wt] of a) {
    const bw = b.get(w);
    if (bw == null) continue;
    shared++;
    sharedWt += Math.max(wt, bw);
    if (wt >= 2 || bw >= 2) sharedDistinct++;
  }
  const totalA = [...a.values()].reduce((s, v) => s + v, 0);
  const totalB = [...b.values()].reduce((s, v) => s + v, 0);
  return { shared, sharedDistinct, minRatio: sharedWt / Math.max(totalA, totalB) };
}

/**
 * Two markets are the same question when they share at least two tokens (one of
 * them distinctive) and most of BOTH titles overlaps.
 *
 * ⚠️ MEASURED 2026-07-20 against the live catalogues (329 Polymarket × 558 Kalshi
 * = 183k comparisons). Title-token overlap does NOT identify cross-venue
 * questions, and no choice of `minOverlap` fixes it:
 *
 *   • Exactly ONE genuine same-question pair existed in the entire live data
 *     ("Will the Democrats win the 2028 US Presidential Election?" ↔ "2028
 *     Presidential Election winner? (Party) · Democratic party"). At the old
 *     0.55 bar, 13 pairs matched — precision ≈ 8%.
 *   • That true pair scores 0.67, and so do SEVEN false ones, including
 *     "· Marco Rubio" and "· Republican party" — the literal complement. The
 *     score ties across right and wrong answers, so it is not discriminative
 *     at any threshold.
 *
 * The cause is structural: Kalshi titles are `Event · Outcome` composites, so
 * the identifying part (the outcome) is a few tokens swamped by the shared
 * event words, while the venues also differ on resolution criteria (a party
 * nomination vs winning the election; one House district vs chamber control).
 *
 * The bar is therefore set where nothing spurious survives. Both callers now
 * fail CLOSED — showing no cross-venue price is correct; showing the
 * complement's price as "the same question elsewhere" is worse than silence in
 * a research product, since it reads as an enormous free spread.
 *
 * Doing this properly needs entity-level matching (normalized subject, outcome
 * and resolution date) or embeddings — not a token ratio.
 */
export const SAME_QUESTION_MIN_OVERLAP = 0.72;

export function isSameQuestion(s: MatchStats, minOverlap: number): boolean {
  return s.shared >= 2 && s.sharedDistinct >= 1 && s.minRatio >= minOverlap;
}

/**
 * Guards the specific failure that produced the worst false positives: pairing a
 * binary market with ONE LEG of a multi-outcome event. The leg's identity lives
 * in `outcomeLabel` ("Marco Rubio", "Republican party"), which barely moves the
 * title ratio — so "Democrats win 2028" matched the Republican leg as strongly
 * as the Democratic one. If a candidate is such a leg, its outcome must be
 * confirmed in the other title, or the pair is rejected.
 */
export function outcomeConfirmed(candidate: Market, otherTitle: string): boolean {
  if (!candidate.outcomeLabel) return true; // plain binary — nothing to confirm
  const tokens = [...titleKeywords(candidate.outcomeLabel).keys()];
  if (tokens.length === 0) return false;
  const hay = otherTitle.toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

/** Same question AND, for multi-outcome legs, the same OUTCOME of it. */
export function isSameQuestionStrict(a: Market, b: Market, s: MatchStats): boolean {
  if (!isSameQuestion(s, SAME_QUESTION_MIN_OVERLAP)) return false;
  return outcomeConfirmed(a, b.title) && outcomeConfirmed(b, a.title);
}

/** Legacy one-sided overlap, kept for callers that only need a rough score. */
export function overlap(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const [w, wt] of a) if (b.has(w)) shared += Math.max(wt, b.get(w)!);
  const totalA = [...a.values()].reduce((s, v) => s + v, 0);
  const totalB = [...b.values()].reduce((s, v) => s + v, 0);
  return shared / Math.min(totalA, totalB);
}
