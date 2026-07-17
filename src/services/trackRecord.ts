import { getSupabase } from '@/lib/supabase';

export interface TrackRecord {
  resolvedPredictions: number;
  beatMarketPct: number; // % of resolved calls where ODDIQ was closer than the market
  brierEdge: number; // positive = ODDIQ more accurate on average
}

/**
 * ODDIQ's rolling accuracy from the `track_record` view. Returns null when there
 * isn't enough resolved history yet (so the UI can hide it until it's credible).
 */
export async function getTrackRecord(minSample = 20): Promise<TrackRecord | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from('track_record').select('*').maybeSingle();
  if (error || !data) return null;
  const resolved = Number(data.resolved_predictions ?? 0);
  if (resolved < minSample) return null; // not credible yet — don't show it
  return {
    resolvedPredictions: resolved,
    beatMarketPct: Number(data.beat_market_pct ?? 0),
    brierEdge: Number(data.brier_edge ?? 0),
  };
}
