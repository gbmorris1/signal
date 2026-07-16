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
   * be the same question, by fuzzy title overlap. Used by the detail screen.
   */
  async findComparables(market: Market): Promise<Market[]> {
    const all = await this.listMarkets();
    const keys = titleKeywords(market.title);
    return all.filter(
      (m) =>
        m.platform !== market.platform &&
        overlap(keys, titleKeywords(m.title)) >= 0.5,
    );
  }
}

const STOP = new Set(['will', 'the', 'a', 'an', 'in', 'by', 'of', 'to', 'on', 'be', 'is', 'at', 'for', 'and', 'or']);

export function titleKeywords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w)),
  );
}

export function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hits = 0;
  for (const w of a) if (b.has(w)) hits++;
  return hits / Math.min(a.size, b.size);
}
