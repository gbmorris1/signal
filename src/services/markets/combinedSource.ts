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
      .filter((x) => isSameQuestion(x.s, 0.55))
      .sort((a, b) => b.s.minRatio - a.s.minRatio)
      .slice(0, 2)
      .map((x) => x.m);
  }

  /**
   * Cross-platform spread scanner. Pairs each Polymarket market with its best
   * Kalshi match (higher overlap bar than findComparables - a wrong pairing
   * would show a phantom "spread"), keeps pairs whose implied probabilities
   * differ by >= minGap, and ranks by gap. Each Kalshi market is used once.
   * Note: a wide spread often reflects DIFFERENT resolution criteria between
   * venues, not free money - the UI frames these as research, not arbitrage.
   */
  async findSpreads(minGap = 0.04): Promise<SpreadPair[]> {
    const all = await this.listMarkets();
    const poly = all.filter((m) => m.platform === 'polymarket');
    const kalshi = all.filter((m) => m.platform === 'kalshi');
    if (poly.length === 0 || kalshi.length === 0) return [];

    const kalshiKeys = kalshi.map((k) => ({ k, keys: titleKeywords(k.title) }));
    const used = new Set<string>();
    const pairs: SpreadPair[] = [];
    for (const p of poly) {
      const pk = titleKeywords(p.title);
      let best: Market | undefined;
      let bestRatio = 0;
      for (const { k, keys } of kalshiKeys) {
        if (k.category !== p.category || used.has(k.id)) continue;
        const s = matchStats(pk, keys);
        // Arb must be the SAME question, not a topically-similar one: require
        // two shared distinctive tokens and heavy two-way overlap.
        if (isSameQuestion(s, 0.72) && s.minRatio > bestRatio) {
          bestRatio = s.minRatio;
          best = k;
        }
      }
      if (!best) continue;
      const gap = Math.abs(p.probability - best.probability);
      if (gap < minGap) continue;
      used.add(best.id);
      // `cheaper` = the venue where YES is priced lower (the side you'd buy).
      const cheaper = p.probability <= best.probability ? p : best;
      pairs.push({ polymarket: p, kalshi: best, gapPts: Math.round(gap * 100), cheaper: cheaper.platform });
    }
    return pairs.sort((a, b) => b.gapPts - a.gapPts).slice(0, 40);
  }
}

export interface SpreadPair {
  polymarket: Market;
  kalshi: Market;
  gapPts: number;
  cheaper: 'polymarket' | 'kalshi';
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
 * them distinctive) and most of BOTH titles overlaps. `minOverlap` sets how
 * strict - comparables are lenient, arbitrage is strict.
 */
export function isSameQuestion(s: MatchStats, minOverlap: number): boolean {
  return s.shared >= 2 && s.sharedDistinct >= 1 && s.minRatio >= minOverlap;
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
