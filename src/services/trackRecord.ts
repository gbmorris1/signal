import { getSupabase } from '@/lib/supabase';

export interface TrackRecord {
  resolvedPredictions: number;
  beatMarketPct: number; // % of resolved calls where ODDIQ was closer than the market
  brierEdge: number; // positive = ODDIQ more accurate on average
}

/** Below this many resolved calls, the numbers aren't statistically credible yet. */
export const TRACK_RECORD_PROVEN_MIN = 15;

/**
 * ODDIQ's rolling accuracy from the `track_record` view. Returns null when there
 * isn't enough resolved history yet, unless `minSample` is lowered - the Home
 * card passes 1 so it can show an honest "still building" state instead of
 * hiding the moat entirely.
 */
export async function getTrackRecord(minSample = TRACK_RECORD_PROVEN_MIN): Promise<TrackRecord | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from('track_record').select('*').maybeSingle();
  if (error || !data) return null;
  const resolved = Number(data.resolved_predictions ?? 0);
  if (resolved < minSample) return null; // not enough history for this caller
  return {
    resolvedPredictions: resolved,
    beatMarketPct: Number(data.beat_market_pct ?? 0),
    brierEdge: Number(data.brier_edge ?? 0),
  };
}
