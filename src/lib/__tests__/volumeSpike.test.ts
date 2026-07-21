import fs from 'fs';
import path from 'path';

import {
  assessVolumeSpike,
  intervalDeltas,
  median,
  VOLUME_BASELINE_MULT,
  VOLUME_BASELINE_MIN_SAMPLES,
} from '../volumeSpike';

/**
 * Cumulative volumes as the detector receives them: NEWEST FIRST.
 * `steady(1000, 10, 5)` = a market at 1000 that has been adding 10 per interval.
 */
function steady(latest: number, perInterval: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => latest - perInterval * i);
}

/**
 * `supabase/functions/sync-markets` duplicates this logic because Deno edge functions
 * can't import app code. The realistic way that mirror rots is someone re-tuning a
 * threshold in one file and not the other, which would silently change live alerting
 * while every test here still passed. Cheap guard against exactly that.
 */
describe('sync-markets mirror', () => {
  const fnSource = fs.readFileSync(
    path.join(__dirname, '../../../supabase/functions/sync-markets/index.ts'),
    'utf8',
  );

  function constantIn(name: string): number {
    const m = fnSource.match(new RegExp(`const ${name} = (-?[0-9.]+);`));
    if (!m) throw new Error(`${name} not found in sync-markets — did the mirror move?`);
    return Number(m[1]);
  }

  it('uses the same threshold as the tested source of truth', () => {
    expect(constantIn('VOLUME_BASELINE_MULT')).toBe(VOLUME_BASELINE_MULT);
  });

  it('uses the same minimum history as the tested source of truth', () => {
    expect(constantIn('VOLUME_BASELINE_MIN_SAMPLES')).toBe(VOLUME_BASELINE_MIN_SAMPLES);
  });

  it('still points back at this module', () => {
    expect(fnSource).toContain('MIRROR of src/lib/volumeSpike.ts');
  });
});

describe('median', () => {
  it('takes the middle of an odd-length set regardless of input order', () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it('averages the two middle values of an even-length set', () => {
    expect(median([1, 3, 5, 7])).toBe(4);
  });

  it('is 0 for an empty set', () => {
    expect(median([])).toBe(0);
  });

  it('does not mutate its argument', () => {
    const xs = [3, 1, 2];
    median(xs);
    expect(xs).toEqual([3, 1, 2]);
  });
});

describe('intervalDeltas', () => {
  it('differences a newest-first series into oldest-to-newest deltas', () => {
    // newest-first 100, 90, 70, 40 → intervals of +30, +20, +10 oldest→newest
    expect(intervalDeltas([100, 90, 70, 40])).toEqual([30, 20, 10]);
  });

  it('yields nothing from a single point', () => {
    expect(intervalDeltas([100])).toEqual([]);
  });
});

describe('assessVolumeSpike', () => {
  it('fires when an interval dwarfs the market’s own recent intervals', () => {
    const priors = steady(100_000, 100, 6);
    const result = assessVolumeSpike(100_000 + 100 * VOLUME_BASELINE_MULT + 1, priors);
    expect(result.spike).toBe(true);
    expect(result.reason).toBe('spike');
    expect(result.baseline).toBe(100);
  });

  it('stays silent just below the threshold', () => {
    const priors = steady(100_000, 100, 6);
    const result = assessVolumeSpike(100_000 + 100 * VOLUME_BASELINE_MULT - 1, priors);
    expect(result.spike).toBe(false);
    expect(result.reason).toBe('below-threshold');
  });

  /**
   * The defect that made the old rule fire on ~91% of its hits: with a flat prior
   * interval, `curDelta >= 4 * prevDelta` reduced to `curDelta >= 0` — always true.
   */
  it('regression: a flat history does not make any increase a spike', () => {
    const priors = [1000, 1000, 1000, 1000, 1000, 1000];
    const result = assessVolumeSpike(1200, priors);
    expect(result.spike).toBe(false);
    expect(result.reason).toBe('flat-baseline');
  });

  /**
   * The property the old fraction-of-cumulative rule could not have: an identical
   * burst relative to a market's own activity must read the same on a young market
   * and an old one. The old rule needed 15% of lifetime volume, so the mature market
   * below would have required 150,000 to fire on the same behaviour.
   */
  it('regression: verdict does not depend on how much lifetime volume has accrued', () => {
    const young = assessVolumeSpike(1_000 + 150, steady(1_000, 10, 6));
    const mature = assessVolumeSpike(1_000_000 + 150, steady(1_000_000, 10, 6));
    expect(young.spike).toBe(true);
    expect(mature.spike).toBe(true);
    expect(young.ratio).toBe(mature.ratio);
  });

  /**
   * Kalshi's `volume_24h_fp` is a rolling window, so the series falls as trades age
   * out. Differencing it is meaningless, and it must never manufacture an alert.
   */
  it('regression: a decreasing (rolling-window) series never fires', () => {
    const result = assessVolumeSpike(300, [400, 500, 450, 600, 380]);
    expect(result.spike).toBe(false);
    expect(result.reason).toBe('no-increase');
  });

  /**
   * The rolling→cumulative cutover replaces values in the hundreds with values in
   * the hundred-thousands, manufacturing one enormous delta. Without this bound it
   * would alert on every Kalshi market at once.
   */
  it('regression: a volume-series restatement is rejected as implausible', () => {
    const rolling24h = [367, 350, 360, 340, 355, 345];
    const result = assessVolumeSpike(112_950, rolling24h);
    expect(result.spike).toBe(false);
    expect(result.reason).toBe('implausible');
  });

  it('rejects an interval larger than the market’s entire prior volume', () => {
    const result = assessVolumeSpike(600, steady(100, 10, 6));
    expect(result.spike).toBe(false);
    expect(result.reason).toBe('implausible');
  });

  it('stays silent until there is enough history to know what normal is', () => {
    const result = assessVolumeSpike(5_000, [1000, 990]);
    expect(result.spike).toBe(false);
    expect(result.reason).toBe('insufficient-history');
  });

  it('stays silent with no prior volume at all', () => {
    expect(assessVolumeSpike(500, []).reason).toBe('no-baseline');
    expect(assessVolumeSpike(500, [0, 0, 0, 0, 0]).reason).toBe('no-baseline');
  });

  it('ignores idle intervals when computing what is normal', () => {
    // Genuine activity is ~10/interval, interrupted by quiet windows. Those zeros
    // must not drag the baseline down and make ordinary trading look explosive.
    const priors = [1000, 990, 990, 980, 980, 970];
    const result = assessVolumeSpike(1010, priors);
    expect(result.baseline).toBe(10);
    expect(result.spike).toBe(false);
  });

  it('reports the ratio it measured so a decision can be debugged', () => {
    const result = assessVolumeSpike(100_000 + 2_000, steady(100_000, 100, 6));
    expect(result.curDelta).toBe(2_000);
    expect(result.baseline).toBe(100);
    expect(result.ratio).toBe(20);
  });
});
