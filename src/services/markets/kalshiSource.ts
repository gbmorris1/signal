import type { Category, Market, MarketSnapshot, MarketDataSource } from '@/types';
import { mapKalshiEvents, type KalshiRawEvent } from './kalshiMap';
import { mockHistory } from '@/data/mockMarkets';

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

/**
 * Live Kalshi data via the public trade API (read endpoints need no auth).
 * Uses the events endpoint with nested markets — the flat /markets listing is
 * dominated by multi-leg parlays. Defensive: failures return the last good
 * cache (or []) so CombinedSource still serves Polymarket results.
 */
export class KalshiSource implements MarketDataSource {
  readonly platform = 'kalshi' as const;
  private cache: Market[] = [];

  async listMarkets(params?: { category?: Category; query?: string }): Promise<Market[]> {
    let markets: Market[];
    try {
      const res = await fetch(`${KALSHI_BASE}/events?limit=200&status=open&with_nested_markets=true`);
      if (!res.ok) throw new Error(`kalshi ${res.status}`);
      const json = (await res.json()) as { events?: KalshiRawEvent[] };
      markets = mapKalshiEvents(json.events ?? []);
      this.cache = markets;
    } catch {
      markets = this.cache; // stale cache beats nothing; [] on first failure
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
    return all.find((m) => m.id === id) ?? null;
  }

  async getHistory(id: string): Promise<MarketSnapshot[]> {
    return mockHistory(id);
  }
}
