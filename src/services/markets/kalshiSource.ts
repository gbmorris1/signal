import type { Category, Market, MarketHistory, MarketDataSource } from '@/types';
import { mapKalshiEvents, type KalshiRawEvent } from './kalshiMap';
import { mockHistory } from '@/data/mockMarkets';

interface KalshiCandle {
  end_period_ts?: number;
  yes_bid?: { close_dollars?: string };
  yes_ask?: { close_dollars?: string };
  volume_fp?: string;
}

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

/**
 * Live Kalshi data via the public trade API (read endpoints need no auth).
 * Uses the events endpoint with nested markets - the flat /markets listing is
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
      // Local-only, unlike PolymarketSource which searches the full catalogue
      // remotely: Kalshi exposes no public text-search endpoint, so this window
      // of open events IS everything we can see. Searching here therefore can't
      // reach beyond it.
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

  async getHistory(id: string): Promise<MarketHistory> {
    // Real history via the candlesticks endpoint (hourly, past week).
    const market = await this.getMarket(id);
    if (market?.historyRef?.includes('/')) {
      try {
        const [series, ticker] = market.historyRef.split('/');
        const now = Math.floor(Date.now() / 1000);
        const weekAgo = now - 7 * 24 * 3600;
        const url = `${KALSHI_BASE}/series/${series}/markets/${ticker}/candlesticks?start_ts=${weekAgo}&end_ts=${now}&period_interval=60`;
        const res = await fetch(url);
        if (res.ok) {
          const json = (await res.json()) as { candlesticks?: KalshiCandle[] };
          const points = (json.candlesticks ?? [])
            .map((c) => {
              const bid = parseFloat(c.yes_bid?.close_dollars ?? '');
              const ask = parseFloat(c.yes_ask?.close_dollars ?? '');
              if (!Number.isFinite(bid) || !Number.isFinite(ask) || !c.end_period_ts) return null;
              return {
                probability: Math.min(0.999, Math.max(0.001, (bid + ask) / 2)),
                volume: parseFloat(c.volume_fp ?? '0') || 0,
                capturedAt: new Date(c.end_period_ts * 1000).toISOString(),
              };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null);
          if (points.length >= 2) return { snapshots: points, synthetic: false };
        }
      } catch {
        /* fall through to synthetic */
      }
    }
    return { snapshots: mockHistory(id), synthetic: true };
  }
}
