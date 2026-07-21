/**
 * Unusual-volume detection — the alert rule's arithmetic.
 *
 * These are the tested source of truth. `supabase/functions/sync-markets` mirrors
 * them (Deno edge functions can't import app code); if you change a rule here,
 * change it there too. Same contract as `src/lib/scoring.ts`.
 *
 * WHY A MEDIAN BASELINE (calibrated 2026-07-20 against 89k live snapshots):
 * the original rule was `curDelta >= 4 × prevDelta AND curDelta >= 15% of cumulative
 * volume`, and both terms were measurably broken.
 *
 *   • `prevDelta` was <= 0 in 98% of intervals — volume simply doesn't move most
 *     15-minute windows — and `x >= 4 * 0` is vacuously true, so the multiplier
 *     gated nothing. ~91% of all fires came through that degenerate branch.
 *   • Fraction-of-cumulative doesn't survive market age. Lifetime volume grows
 *     without bound, so an identical burst scores ~100× lower on a six-month-old
 *     market than a day-old one. Measured p98 of curDelta/cumulative on Polymarket
 *     was 0.0039, so a 0.15 threshold could essentially never fire there, while the
 *     same constant sat below Kalshi's p90 and fired constantly. One constant,
 *     both failure modes, on different venues.
 *
 * Comparing an interval against the median of the market's OWN recent intervals is
 * self-normalizing: scale-free across venues (Polymarket USD vs Kalshi contracts)
 * and across market age. No single ratio-to-a-fixed-denominator can be both.
 */

/**
 * Fire when an interval is this many times the market's own median interval.
 * Measured curDelta/median on Polymarket (the source with correct cumulative data):
 * p90 = 8.1, p98 = 33.3. Sitting just above p90 is deliberate — a false push costs
 * far more than a missed one.
 *
 * ⚠️ Calibrated on a thin sample (67 usable Polymarket intervals; Kalshi had no
 * valid cumulative history before the 2026-07-20 cutover). Re-measure.
 */
export const VOLUME_BASELINE_MULT = 12;

/** Below this many prior intervals there's no honest notion of "normal" yet. */
export const VOLUME_BASELINE_MIN_SAMPLES = 4;

export type SpikeReason =
  | 'spike'
  | 'no-baseline'
  | 'no-increase'
  | 'insufficient-history'
  | 'flat-baseline'
  | 'below-threshold'
  | 'implausible';

export interface SpikeAssessment {
  spike: boolean;
  reason: SpikeReason;
  /** Volume added over the newest interval. */
  curDelta: number;
  /** Median of the market's prior positive intervals. */
  baseline: number;
  /** curDelta / baseline, or 0 when there's no usable baseline. */
  ratio: number;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Per-interval deltas from cumulative volumes given NEWEST-FIRST, returned
 * oldest→newest. Non-finite results are dropped rather than poisoning the median.
 */
export function intervalDeltas(priorVolsNewestFirst: number[]): number[] {
  const out: number[] = [];
  for (let i = priorVolsNewestFirst.length - 1; i > 0; i--) {
    const d = priorVolsNewestFirst[i - 1] - priorVolsNewestFirst[i];
    if (Number.isFinite(d)) out.push(d);
  }
  return out;
}

/**
 * @param current  Latest CUMULATIVE volume.
 * @param priorVolsNewestFirst  Prior cumulative volumes, most recent first.
 *
 * Both must be lifetime-cumulative. Feeding a rolling window (Kalshi's
 * `volume_24h_fp`) makes every delta meaningless — it decreases as trades age out.
 */
export function assessVolumeSpike(
  current: number,
  priorVolsNewestFirst: number[],
): SpikeAssessment {
  const prev0 = priorVolsNewestFirst[0];
  const curDelta = current - prev0;
  const none = (reason: SpikeReason, d = 0): SpikeAssessment => ({
    spike: false,
    reason,
    curDelta: d,
    baseline: 0,
    ratio: 0,
  });

  if (!(prev0 > 0)) return none('no-baseline');
  if (!(curDelta > 0)) return none('no-increase', curDelta);

  const deltas = intervalDeltas(priorVolsNewestFirst);
  // A market that just entered the top-N by volume has no history. Staying silent
  // beats guessing at what's normal for it.
  if (deltas.length < VOLUME_BASELINE_MIN_SAMPLES) {
    return none('insufficient-history', curDelta);
  }

  // Only positive intervals describe trading activity; zero-volume windows would
  // drag the median to 0 and make every subsequent trade look like a spike.
  const baseline = median(deltas.filter((d) => d > 0));
  if (!(baseline > 0)) return none('flat-baseline', curDelta);

  const ratio = curDelta / baseline;

  // A single interval cannot legitimately exceed the market's entire prior lifetime
  // volume. Rejects brand-new markets whose tiny denominator produced ratios in the
  // thousands, and any venue-side restatement of the volume series (e.g. the Kalshi
  // rolling→cumulative field switch, which manufactures exactly one enormous delta
  // and would otherwise alert every Kalshi market at once).
  if (curDelta > prev0) {
    return { spike: false, reason: 'implausible', curDelta, baseline, ratio };
  }
  if (ratio < VOLUME_BASELINE_MULT) {
    return { spike: false, reason: 'below-threshold', curDelta, baseline, ratio };
  }
  return { spike: true, reason: 'spike', curDelta, baseline, ratio };
}
