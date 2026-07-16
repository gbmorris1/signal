import type { Category, Market, MarketHistory, MarketDataSource } from '@/types';
import { mapPolymarketMarket, isLiveProbability, type PolymarketRaw } from './polymarketMap';
import { MockSource } from './mockSource';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const CLOB_BASE = 'https://clob.polymarket.com';

/**
 * Live Polymarket data via the public Gamma API. Defensive: any network/parse
 * failure falls back to MockSource so the UI never breaks. History is
 * synthesized locally until we persist snapshots server-side.
 */
export class PolymarketSource implements MarketDataSource {
  readonly platform = 'polymarket' as const;
  private fallback = new MockSource();
  private cache: Market[] = [];

  async listMarkets(params?: { category?: Category; query?: string }): Promise<Market[]> {
    let markets: Market[];
    try {
      const url = `${GAMMA_BASE}/markets?active=true&closed=false&limit=100&order=volume&ascending=false`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`gamma ${res.status}`);
      const raw = (await res.json()) as PolymarketRaw[];
      markets = raw
        .map(mapPolymarketMarket)
        .filter((m): m is Market => m !== null)
        .filter((m) => isLiveProbability(m.probability));
      if (markets.length === 0) throw new Error('empty');
      this.cache = markets;
    } catch {
      markets = await this.fallback.listMarkets();
    }

    if (params?.category) markets = markets.filter((m) => m.category === params.category);
    if (params?.query) {
      const q = params.query.toLowerCase();
      markets = markets.filter((m) => m.title.toLowerCase().includes(q));
    }
    return markets;
  }

  async getMarket(id: string): Promise<Market | null> {
    const cached = this.cache.find((m) => m.id === id);
    if (cached) return cached;
    const all = await this.listMarkets();
    return all.find((m) => m.id === id) ?? this.fallback.getMarket(id);
  }

  async getHistory(id: string): Promise<MarketHistory> {
    // Real price history from the CLOB per-token endpoint.
    const market = await this.getMarket(id);
    if (market?.historyRef) {
      try {
        const url = `${CLOB_BASE}/prices-history?market=${market.historyRef}&interval=1w&fidelity=180`;
        const res = await fetch(url);
        if (res.ok) {
          const json = (await res.json()) as { history?: Array<{ t: number; p: number }> };
          const points = (json.history ?? [])
            .filter((h) => Number.isFinite(h.t) && Number.isFinite(h.p))
            .map((h) => ({
              probability: Math.min(0.999, Math.max(0.001, h.p)),
              volume: market.volume,
              capturedAt: new Date(h.t * 1000).toISOString(),
            }));
          if (points.length >= 2) return { snapshots: points, synthetic: false };
        }
      } catch {
        /* fall through to synthetic */
      }
    }
    return this.fallback.getHistory(id);
  }
}
