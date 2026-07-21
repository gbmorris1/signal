import type { Category, Market, MarketHistory, MarketDataSource } from '@/types';
import { mapPolymarketMarket, isLiveProbability, type PolymarketRaw } from './polymarketMap';
import { mockHistory } from '@/data/mockMarkets';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const CLOB_BASE = 'https://clob.polymarket.com';

/**
 * Live Polymarket data via the public Gamma API.
 *
 * On failure it degrades to the last GOOD LIVE response, never to mock data.
 * This is a research product: showing fabricated markets styled as real prices
 * would be worse than showing nothing, and any analysis run against a fake
 * market would also be logged into the track record. Same contract as
 * KalshiSource. Real mock data is only ever served by MockSource in dev mode.
 */
export class PolymarketSource implements MarketDataSource {
  readonly platform = 'polymarket' as const;
  private cache: Market[] = [];
  /**
   * Markets resolved individually (by search or by slug) rather than from the
   * browse catalog. Kept OUT of `cache` on purpose: `cache` doubles as the
   * last-good-live fallback for the whole catalog, and one searched market must
   * never end up standing in for the browse feed.
   */
  private resolved = new Map<string, Market>();

  private toMarkets(raw: PolymarketRaw[]): Market[] {
    return raw
      .map(mapPolymarketMarket)
      .filter((m): m is Market => m !== null)
      .filter((m) => isLiveProbability(m.probability));
  }

  /**
   * Full-catalog search. The browse endpoint only ever returns the top N by
   * volume, so without this a user searching for anything outside that window
   * gets an empty state that reads as "this market doesn't exist" rather than
   * "not in our catalog" — on a product whose whole pitch is research.
   *
   * `public-search` returns EVENTS with their markets nested, in the same shape
   * the browse endpoint returns, so the normal mapper applies (it already drops
   * closed markets).
   */
  private async searchRemote(query: string): Promise<Market[]> {
    const url = `${GAMMA_BASE}/public-search?q=${encodeURIComponent(query)}&limit_per_type=20`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`gamma search ${res.status}`);
    const json = (await res.json()) as { events?: Array<{ markets?: PolymarketRaw[] }> };
    const events = Array.isArray(json?.events) ? json.events : [];
    const raw = events.flatMap((e) => (Array.isArray(e?.markets) ? e.markets : []));
    const markets = this.toMarkets(raw.filter((m) => m.active !== false));
    for (const m of markets) this.resolved.set(m.id, m);
    return markets;
  }

  async listMarkets(params?: { category?: Category; query?: string }): Promise<Market[]> {
    let markets: Market[];
    try {
      const url = `${GAMMA_BASE}/markets?active=true&closed=false&limit=100&order=volume&ascending=false`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`gamma ${res.status}`);
      const raw = (await res.json()) as PolymarketRaw[];
      markets = this.toMarkets(raw);
      if (markets.length === 0) throw new Error('empty');
      this.cache = markets;
    } catch {
      markets = this.cache; // stale-but-real beats fabricated; [] on first failure
    }

    const q = params?.query?.trim().toLowerCase();
    if (q) {
      const local = markets.filter((m) => m.title.toLowerCase().includes(q));
      let remote: Market[] = [];
      try {
        remote = await this.searchRemote(q);
      } catch {
        // Search is additive: a failed lookup still leaves the local matches,
        // which is strictly better than surfacing an error over usable results.
        remote = [];
      }
      // Catalog hits first — they carry the browse ordering the user just saw.
      const seen = new Set(local.map((m) => m.id));
      markets = [...local, ...remote.filter((m) => !seen.has(m.id))];
    }

    if (params?.category) markets = markets.filter((m) => m.category === params.category);
    return markets;
  }

  /**
   * Fetches one market by slug, so anything outside the browse window is still
   * reachable by id — which is what deep links and saved watchlist entries need.
   */
  private async fetchBySlug(id: string): Promise<Market | null> {
    const slug = id.replace(/^polymarket:/, '');
    try {
      const res = await fetch(`${GAMMA_BASE}/markets?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) return null;
      const raw = (await res.json()) as PolymarketRaw[];
      const market = this.toMarkets(Array.isArray(raw) ? raw : [])[0] ?? null;
      if (market) this.resolved.set(market.id, market);
      return market;
    } catch {
      return null;
    }
  }

  async getMarket(id: string): Promise<Market | null> {
    const cached = this.cache.find((m) => m.id === id) ?? this.resolved.get(id);
    if (cached) return cached;
    const all = await this.listMarkets();
    const hit = all.find((m) => m.id === id);
    if (hit) return hit;
    // Not in the top-N browse window — ask for it directly rather than
    // reporting a real market as missing.
    return this.fetchBySlug(id);
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
    // Synthetic curve, explicitly flagged so the UI can label it a simulated
    // preview. Unlike prices, an unlabelled placeholder chart isn't presented
    // as fact.
    return { snapshots: mockHistory(id), synthetic: true };
  }
}
