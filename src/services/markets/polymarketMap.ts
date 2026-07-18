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
  clobTokenIds?: string; // JSON string of CLOB token ids (YES first)
  description?: string;
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

// Native platform categories → Signal categories. Checked FIRST - the
// platform's own taxonomy beats keyword guessing every time.
const NATIVE_CATEGORY: Record<string, Category> = {
  // Kalshi
  politics: 'politics',
  elections: 'politics',
  economics: 'finance',
  financials: 'finance',
  companies: 'finance',
  'science and technology': 'technology',
  sports: 'sports',
  world: 'world',
  'climate and weather': 'world',
  entertainment: 'world',
  social: 'world',
  health: 'world',
  transportation: 'world',
  // Polymarket (when present)
  'us-current-affairs': 'politics',
  crypto: 'crypto',
  business: 'finance',
  science: 'technology',
  'pop-culture': 'world',
};

/**
 * Map a platform category/keywords to Signal's fixed category set.
 * Word-boundary matching only. Substring matching put "whether" in crypto
 * (eth) and "rain" in technology (ai) - never again.
 */
export function mapCategory(input: string | undefined, question: string): Category {
  const native = input?.trim().toLowerCase();
  if (native && NATIVE_CATEGORY[native]) return NATIVE_CATEGORY[native];

  const hay = question.toLowerCase();
  const has = (re: RegExp) => re.test(hay);
  if (has(/\b(bitcoin|btc|eth|ethereum|crypto|solana|blockchain|memecoin|stablecoin|xrp|dogecoin)\b/))
    return 'crypto';
  if (has(/\b(fed|rates?|inflation|cpi|gdp|recession|stocks?|s&p|nasdaq|earnings|economy|tariffs?|treasury)\b/))
    return 'finance';
  if (has(/\b(election|president|presidential|senate|congress|trump|biden|governor|polls?|votes?|impeach|primary|nominee|parliament|minister)\b/))
    return 'politics';
  if (has(/\b(nba|nfl|mlb|nhl|soccer|premier league|ufc|olympics?|super bowl|world cup|f1|grand prix|playoffs?|finals?|champions league|tennis|golf)\b/))
    return 'sports';
  if (has(/\b(openai|chatgpt|gpt|anthropic|artificial intelligence|chips?|semiconductor|software|iphone|apple|google|microsoft|tesla|spacex|nasa|rocket|satellite)\b/))
    return 'technology';
  return 'world';
}

// Effectively-settled markets (≥96% / ≤4%) carry no intelligence value - the
// question is decided. Feeds filter to live uncertainty.
const SETTLED_BAND = 0.96;
export function isLiveProbability(p: number): boolean {
  return p < SETTLED_BAND && p > 1 - SETTLED_BAND;
}

/** Derive an AI signal from movement + liquidity until a real model score exists. */
export function deriveSignal(change24h: number, volume: number): AISignal {
  const mag = Math.abs(change24h);
  if (mag >= 0.06 && volume > 500_000) return 'opportunity';
  if (mag >= 0.03) return 'watch';
  if (change24h < -0.05) return 'caution';
  return 'neutral';
}

/**
 * Heuristic AI score (0..100) until the model pipeline scores markets
 * server-side. Blends three signals so scores actually spread:
 *  - movement: how sharply the market repriced (dominant)
 *  - liquidity: log-scaled volume, so $10k vs $10M differ but $8M vs $10M don't
 *  - uncertainty: markets near 50% are inherently more interesting than
 *    foregone conclusions at 2% or 98%
 */
export interface ScoreComponents {
  movement: number; // 0..1
  liquidity: number; // 0..1
  uncertainty: number; // 0..1
}

export const SCORE_WEIGHTS = { movement: 0.45, liquidity: 0.35, uncertainty: 0.2 } as const;

export function scoreComponents(
  change24h: number,
  volume: number,
  probability = 0.5,
): ScoreComponents {
  return {
    movement: Math.min(1, Math.abs(change24h) / 0.1),
    liquidity: Math.min(1, Math.log10(volume + 1) / 7), // 10M ≈ 1.0
    uncertainty: 1 - Math.abs(probability - 0.5) * 2,
  };
}

export function heuristicScore(change24h: number, volume: number, probability = 0.5): number {
  const c = scoreComponents(change24h, volume, probability);
  return Math.round(
    (SCORE_WEIGHTS.movement * c.movement +
      SCORE_WEIGHTS.liquidity * c.liquidity +
      SCORE_WEIGHTS.uncertainty * c.uncertainty) *
      100,
  );
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
  const clobTokens = parseJsonArray(raw.clobTokenIds);
  // Real outcome names when present ("Norris"/"Verstappen"), else Yes/No. A
  // single named outcome with no opposite defaults its other side to "Other".
  const outcomes = parseJsonArray(raw.outcomes);
  const outcomeLabels: [string, string] =
    outcomes.length >= 2
      ? [outcomes[0], outcomes[1]]
      : outcomes.length === 1
        ? [outcomes[0], 'Other']
        : ['Yes', 'No'];

  return {
    id: `polymarket:${externalId}`,
    externalId,
    platform: 'polymarket',
    title: question,
    category,
    probability,
    change24h,
    volume,
    aiScore: heuristicScore(change24h, volume, probability),
    signal: deriveSignal(change24h, volume),
    updatedAt: new Date().toISOString(),
    historyRef: clobTokens[0], // YES token id → CLOB prices-history
    outcomeLabels,
    description: raw.description?.trim() || undefined,
  };
}
