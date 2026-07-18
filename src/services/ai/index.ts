import Constants from 'expo-constants';
import type { AIAnalysis, Market, MarketSnapshot } from '@/types';
import { MOCK_ANALYSIS } from '@/data/mockMarkets';
import { parseAIAnalysis } from './schema';

const useMock = Constants.expoConfig?.extra?.useMockData !== false;
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string | undefined;

/** Stable hash of the analysis inputs; used for caching (client + `ai_analysis` table). */
export function snapshotHash(market: Market, history: MarketSnapshot[]): string {
  const last = history[history.length - 1]?.probability ?? market.probability;
  return `${market.id}:${market.probability.toFixed(3)}:${last.toFixed(3)}`;
}

const cache = new Map<string, AIAnalysis>();

function fallbackAnalysis(market: Market): AIAnalysis {
  const canned = MOCK_ANALYSIS[market.id];
  if (canned) return canned;
  const dir = market.change24h >= 0 ? 'up' : 'down';
  return {
    marketId: market.id,
    edge: `ODDIQ couldn't reach the live analysis engine just now, so this is a price-only preview (market at ${Math.round(market.probability * 100)}%). Tap Explain again in a moment for the full news-backed edge.`,
    summary: `"${market.title}" is trading at ${Math.round(market.probability * 100)}% and moved ${dir} over the last 24 hours.`,
    bullCase: 'Momentum and recent flow favor the YES side; watch for confirmation from upcoming catalysts.',
    bearCase: 'The move may be noise; mean-reversion is likely if no new information arrives.',
    whyChanged: `Probability shifted ${Math.round(market.change24h * 100)} points, likely on repositioning ahead of a known event.`,
    catalysts: ['Upcoming data release', 'Related news flow'],
    riskFactors: ['Low liquidity', 'Headline risk'],
    confidence: 'medium',
    aiProbabilityEstimate: market.probability,
    sources: [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generate (or return cached) AI analysis for a market.
 * In production this calls the `analyze-market` Supabase Edge Function, which
 * holds the Anthropic key and returns Zod-validated structured JSON. In dev /
 * without keys, returns a canned analysis so the app remains fully functional.
 */
export type AnalysisDepth = 'shallow' | 'standard' | 'deep';

/** Server said the user is over their daily quota; carries an upsell teaser. */
export interface GatedResult {
  gated: true;
  teaser: string;
}
export type AnalysisResult = AIAnalysis | GatedResult;

export function isGated(r: AnalysisResult): r is GatedResult {
  return (r as GatedResult).gated === true;
}

/** Other outcomes in the same multi-outcome event, so the model can reason across the field. */
export interface FieldOutcome {
  label: string;
  probability: number;
}

export async function generateAnalysis(
  market: Market,
  history: MarketSnapshot[],
  depth: AnalysisDepth = 'standard',
  field?: FieldOutcome[],
): Promise<AnalysisResult> {
  const fieldKey = field && field.length > 0 ? `:f${field.length}` : '';
  const key = `${snapshotHash(market, history)}:${depth}${fieldKey}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let result: AIAnalysis;
  if (useMock || !supabaseUrl || supabaseUrl.includes('PLACEHOLDER')) {
    result = fallbackAnalysis(market);
  } else {
    try {
      // Authenticate as the signed-in user so the function can enforce their
      // real tier + daily quota server-side.
      const { getSupabase } = await import('@/lib/supabase');
      const supabase = getSupabase();
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      const res = await fetch(`${supabaseUrl}/functions/v1/analyze-market`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ market, history, depth, field }),
      });
      const json = await res.json();
      if (json?.gated) {
        // Server-enforced limit hit - surface the teaser, don't cache.
        return { gated: true, teaser: String(json.teaser ?? '') };
      }
      const parsed = parseAIAnalysis(json);
      result = {
        marketId: market.id,
        edge: parsed.edge,
        summary: parsed.summary,
        bullCase: parsed.bull_case,
        bearCase: parsed.bear_case,
        whyChanged: parsed.why_changed,
        catalysts: parsed.catalysts,
        riskFactors: parsed.risk_factors,
        confidence: parsed.confidence,
        aiProbabilityEstimate: parsed.ai_probability_estimate,
        sources: parsed.sources.map((s) => ({ title: s.title, url: s.url, date: s.date ?? null })),
        createdAt: new Date().toISOString(),
      };
    } catch (e) {
      if (__DEV__) console.warn('analyze-market call failed, using fallback:', e);
      result = fallbackAnalysis(market);
    }
  }

  cache.set(key, result);
  return result;
}

/**
 * Most recent CACHED analysis for a market, any snapshot/depth - used for the
 * gated teaser. Never triggers a model call; returns null when nothing cached.
 */
export async function fetchCachedAnalysis(marketId: string): Promise<AIAnalysis | null> {
  const { getSupabase } = await import('@/lib/supabase');
  const supabase = getSupabase();
  if (!supabase) return MOCK_ANALYSIS[marketId] ?? null;
  const { data } = await supabase
    .from('ai_analysis')
    .select('*')
    .eq('market_id', marketId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    marketId,
    edge: data.edge ?? '',
    summary: data.summary,
    bullCase: data.bull_case,
    bearCase: data.bear_case,
    whyChanged: data.why_changed,
    catalysts: data.catalysts ?? [],
    riskFactors: data.risk_factors ?? [],
    confidence: data.confidence ?? 'medium',
    aiProbabilityEstimate: data.ai_probability_estimate,
    sources: data.sources ?? [],
    createdAt: data.created_at,
  };
}

/** First sentence of a summary, for teaser display. */
export function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}
