/**
 * Track-record scoring rules — the moat's arithmetic.
 *
 * These are the tested source of truth. `supabase/functions/resolve-predictions`
 * mirrors them (Deno edge functions can't import app code); if you change a rule
 * here, change it there too. Everything ODDIQ markets rests on these numbers
 * being right, so they get the most rigorous tests in the codebase.
 */

/** Brier score: squared error of a probabilistic forecast. Lower is better. */
export function brier(probability: number, outcome: 0 | 1): number {
  return (probability - outcome) ** 2;
}

export type Verdict = 'beat' | 'lost' | 'tie';

export interface ScoredPrediction {
  aiBrier: number;
  marketBrier: number;
  verdict: Verdict;
  /** True only for a strict win. Ties are NOT wins. */
  aiCorrect: boolean;
}

/**
 * Score one resolved prediction. A tie is a *push*, not a loss: when the model
 * simply agrees with the market (common at shallow depth, where it has no news
 * and anchors to the price) there is no forecasting skill to credit either way.
 * Counting those as losses systematically understates the record.
 */
export function scorePrediction(
  aiProbability: number,
  marketProbability: number,
  outcome: 0 | 1,
): ScoredPrediction {
  const aiBrier = brier(aiProbability, outcome);
  const marketBrier = brier(marketProbability, outcome);
  // Float noise shouldn't decide a verdict on identical inputs.
  const tie = Math.abs(aiBrier - marketBrier) < 1e-9;
  const verdict: Verdict = tie ? 'tie' : aiBrier < marketBrier ? 'beat' : 'lost';
  return { aiBrier, marketBrier, verdict, aiCorrect: verdict === 'beat' };
}

/**
 * Polymarket outcome from a market payload. `closed` alone is NOT enough: a
 * market can be closed while resolution is still pending, and its YES price can
 * sit mid-range. Only a decisively settled price counts, otherwise we'd write a
 * wrong outcome into a permanent record.
 */
export function polymarketOutcomeFromPrice(
  closed: boolean,
  yesPrice: number | null | undefined,
): 0 | 1 | null {
  if (!closed || yesPrice == null || !Number.isFinite(yesPrice)) return null;
  if (yesPrice >= 0.95) return 1;
  if (yesPrice <= 0.05) return 0;
  return null; // closed but not settled — check again later
}

/** Predictions older than this are treated as never going to resolve. */
export const STALE_PREDICTION_DAYS = 180;

/**
 * Whether a prediction should still be polled for resolution. Without this the
 * oldest never-settling predictions permanently fill the batch and newer ones
 * are never scored (head-of-line blocking).
 */
export function isWorthResolving(createdAt: string | Date, now: Date = new Date()): boolean {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const ageDays = (now.getTime() - created.getTime()) / 86_400_000;
  return ageDays <= STALE_PREDICTION_DAYS;
}
