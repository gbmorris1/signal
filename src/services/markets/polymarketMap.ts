import type { AISignal, Category, Market } from '@/types';

// Raw shape from the Polymarket Gamma API (subset we rely on; all optional/defensive).
export interface PolymarketRaw {
  id?: string | number;
  slug?: string;
  question?: string;
  category?: string;
  volume?: string | number;
  volumeNum?: number;
  liquidity?: string | number;
  outcomes?: string; // JSON string, e.g. '["Yes","No"]'
  outcomePrices?: string; // JSON string, e.g. '["0.43","0.57"]'
  oneDayPriceChange?: number;
  active?: boolean;
  closed?: boolean;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function parseJsonArray(s: string | undefined): string[] {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

/** Map a Polymarket category/keyword to Signal's fixed category set. */
export function mapCategory(input: string | undefined, question: string): Category {
  const hay = `${input ?? ''} ${question}`.toLowerCase();
  if (/(fed|rate|inflation|cpi|gdp|recession|stock|s&p|earnings|economy)/.test(hay)) return 'finance';
  if (/(bitcoin|btc|eth|crypto|solana|token|blockchain)/.test(hay)) return 'crypto';
  if (/(election|president|senate|congress|trump|biden|poll|vote|policy)/.test(hay)) return 'politics';
  if (/(nba|nfl|mlb|soccer|premier|ufc|olympic|super bowl|world cup|match)/.test(hay)) return 'sports';
  if (/(ai|openai|gpt|chip|tech|software|apple|google|spacex)/.test(hay)) return 'technology';
  return 'world';
}

/** Derive an AI signal from movement + liquidity until a real model score exists. */
export function deriveSignal(change24h: number, volume: number): AISignal {
  const mag = Math.abs(change24h);
  if (mag >= 0.06 && volume > 500_000) return 'opportunity';
  if (mag >= 0.03) return 'watch';
  if (change24h < -0.05) return 'caution';
  return 'neutral';
}

/** Heuristic AI score (0..100) until the model pipeline scores markets server-side. */
export function heuristicScore(change24h: number, volume: number): number {
  const move = Math.min(1, Math.abs(change24h) / 0.15);
  const liq = Math.min(1, volume / 10_000_000);
  return Math.round((0.6 * move + 0.4 * liq) * 100);
}

/** Pure mapping from a raw Polymarket market to Signal's `Market`. Returns null if unusable. */
export function mapPolymarketMarket(raw: PolymarketRaw): Market | null {
  if (raw.closed) return null;
  const question = raw.question?.trim();
  if (!question) return null;

  const prices = parseJsonArray(raw.outcomePrices).map((p) => num(p));
  // First outcome price = probability of the primary (YES) outcome.
  const probability = prices.length > 0 ? Math.min(0.999, Math.max(0.001, prices[0])) : 0.5;
  const change24h = num(raw.oneDayPriceChange, 0);
  const volume = num(raw.volumeNum ?? raw.volume, 0);
  const category = mapCategory(raw.category, question);
  const externalId = String(raw.slug ?? raw.id ?? question);

  return {
    id: `polymarket:${externalId}`,
    externalId,
    platform: 'polymarket',
    title: question,
    category,
    probability,
    change24h,
    volume,
    aiScore: heuristicScore(change24h, volume),
    signal: deriveSignal(change24h, volume),
    updatedAt: new Date().toISOString(),
  };
}
