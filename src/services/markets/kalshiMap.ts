import type { Market } from '@/types';
import { mapCategory, deriveSignal, heuristicScore } from './polymarketMap';

// Kalshi trade API v2. Single-question markets are nested under events:
//   GET https://api.elections.kalshi.com/trade-api/v2/events?status=open&with_nested_markets=true
// Prices arrive as dollar strings in 0..1 (e.g. "0.1300"); volumes as
// fixed-point strings/numbers in the *_fp fields.

export interface KalshiRawMarket {
  ticker?: string;
  status?: string; // 'active' | ...
  yes_sub_title?: string;
  last_price_dollars?: string | number;
  previous_price_dollars?: string | number;
  yes_bid_dollars?: string | number;
  yes_ask_dollars?: string | number;
  volume_24h_fp?: string | number;
  volume_fp?: string | number;
}

export interface KalshiRawEvent {
  event_ticker?: string;
  title?: string;
  category?: string;
  markets?: KalshiRawMarket[];
}

function dollars(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 1) return null;
  return n;
}

function fp(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

/** Map one nested market within an event. Returns null if unusable. */
export function mapKalshiMarket(event: KalshiRawEvent, raw: KalshiRawMarket): Market | null {
  if (raw.status && raw.status !== 'active') return null;
  const eventTitle = event.title?.trim();
  const ticker = raw.ticker?.trim();
  if (!eventTitle || !ticker) return null;

  // Price preference: last trade, else bid/ask midpoint.
  const last = dollars(raw.last_price_dollars);
  const bid = dollars(raw.yes_bid_dollars);
  const ask = dollars(raw.yes_ask_dollars);
  const mid = bid != null && ask != null && (bid > 0 || ask > 0) ? (bid + ask) / 2 : null;
  const probability = last && last > 0 ? last : mid;
  if (probability == null || probability <= 0) return null;

  const prev = dollars(raw.previous_price_dollars);
  const change24h = prev != null && prev > 0 ? probability - prev : 0;
  const volume = fp(raw.volume_24h_fp) || fp(raw.volume_fp);

  // Multi-outcome events ("Who will be the next Pope?") have several nested
  // markets; qualify the title with the outcome so each row reads standalone.
  const sub = raw.yes_sub_title?.trim();
  const multi = (event.markets?.length ?? 1) > 1;
  const title = multi && sub ? `${eventTitle} — ${sub}` : eventTitle;

  return {
    id: `kalshi:${ticker}`,
    externalId: ticker,
    platform: 'kalshi',
    title,
    category: mapCategory(event.category, eventTitle),
    probability: Math.min(0.999, Math.max(0.001, probability)),
    change24h,
    volume,
    aiScore: heuristicScore(change24h, volume),
    signal: deriveSignal(change24h, volume),
    updatedAt: new Date().toISOString(),
  };
}

// Multi-outcome events can carry dozens of long-shot legs (every 1% candidate
// in an election). Keep the feed signal-dense: per event, keep the top legs by
// volume and drop sub-2% long shots (binary events are always kept whole).
const MAX_LEGS_PER_EVENT = 3;
const MIN_LEG_PROBABILITY = 0.02;

/** Map a page of events (with nested markets) to curated Signal markets. */
export function mapKalshiEvents(events: KalshiRawEvent[]): Market[] {
  const out: Market[] = [];
  for (const e of events) {
    const legs = (e.markets ?? [])
      .map((m) => mapKalshiMarket(e, m))
      .filter((m): m is Market => m !== null);
    if (legs.length <= 1) {
      out.push(...legs);
      continue;
    }
    const curated = legs
      .filter((m) => m.probability >= MIN_LEG_PROBABILITY)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, MAX_LEGS_PER_EVENT);
    out.push(...curated);
  }
  return out;
}
