import type { Category, Market, MarketHistory, MarketDataSource } from '@/types';

/**
 * Merges multiple platform sources behind the single MarketDataSource
 * interface. Lists run in parallel; a failing platform degrades to its own
 * fallback (or []) without breaking the others.
 */
export class CombinedSource implements MarketDataSource {
  readonly platform = 'mock' as const; // aggregate — platform is per-market

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
   * "Fed", "September", "Trump", "100k"). Returns the best matches first, max 2 —
   * most markets are platform-exclusive, and the UI says so honestly.
   */
  async findComparables(market: Market): Promise<Market[]> {
    const all = await this.listMarkets();
    const keys = titleKeywords(market.title);
    return all
      .filter((m) => m.platform !== market.platform && m.category === market.category)
      .map((m) => ({ m, score: overlap(keys, titleKeywords(m.title)) }))
      .filter((x) => x.score >= 0.55)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((x) => x.m);
  }
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

/** Weighted overlap: shared identifying tokens / smaller side's total weight. */
export function overlap(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const [w, wt] of a) if (b.has(w)) shared += Math.max(wt, b.get(w)!);
  const totalA = [...a.values()].reduce((s, v) => s + v, 0);
  const totalB = [...b.values()].reduce((s, v) => s + v, 0);
  return shared / Math.min(totalA, totalB);
}
