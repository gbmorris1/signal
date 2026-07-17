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
    summary: `"${market.title}" is trading at ${Math.round(market.probability * 100)}% and moved ${dir} over the last 24 hours.`,
    bullCase: 'Momentum and recent flow favor the YES side; watch for confirmation from upcoming catalysts.',
    bearCase: 'The move may be noise; mean-reversion is likely if no new information arrives.',
    whyChanged: `Probability shifted ${Math.round(market.change24h * 100)} points, likely on repositioning ahead of a known event.`,
    catalysts: ['Upcoming data release', 'Related news flow'],
    riskFactors: ['Low liquidity', 'Headline risk'],
    confidence: 'medium',
    aiProbabilityEstimate: market.probability,
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

export async function generateAnalysis(
  market: Market,
  history: MarketSnapshot[],
  depth: AnalysisDepth = 'standard',
): Promise<AIAnalysis> {
  const key = `${snapshotHash(market, history)}:${depth}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let result: AIAnalysis;
  if (useMock || !supabaseUrl || supabaseUrl.includes('PLACEHOLDER')) {
    result = fallbackAnalysis(market);
  } else {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/analyze-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market, history, depth }),
      });
      const json = await res.json();
      const parsed = parseAIAnalysis(json);
      result = {
        marketId: market.id,
        summary: parsed.summary,
        bullCase: parsed.bull_case,
        bearCase: parsed.bear_case,
        whyChanged: parsed.why_changed,
        catalysts: parsed.catalysts,
        riskFactors: parsed.risk_factors,
        confidence: parsed.confidence,
        aiProbabilityEstimate: parsed.ai_probability_estimate,
        createdAt: new Date().toISOString(),
      };
    } catch {
      result = fallbackAnalysis(market);
    }
  }

  cache.set(key, result);
  return result;
}

/**
 * Most recent CACHED analysis for a market, any snapshot/depth — used for the
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
    summary: data.summary,
    bullCase: data.bull_case,
    bearCase: data.bear_case,
    whyChanged: data.why_changed,
    catalysts: data.catalysts ?? [],
    riskFactors: data.risk_factors ?? [],
    confidence: data.confidence ?? 'medium',
    aiProbabilityEstimate: data.ai_probability_estimate,
    createdAt: data.created_at,
  };
}

/** First sentence of a summary, for teaser display. */
export function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}
