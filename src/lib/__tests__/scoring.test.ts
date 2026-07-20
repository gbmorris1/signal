import {
  brier,
  scorePrediction,
  polymarketOutcomeFromPrice,
  isWorthResolving,
  STALE_PREDICTION_DAYS,
} from '../scoring';

describe('brier', () => {
  it('is 0 for a perfect forecast', () => {
    expect(brier(1, 1)).toBe(0);
    expect(brier(0, 0)).toBe(0);
  });
  it('is 1 for a maximally wrong forecast', () => {
    expect(brier(0, 1)).toBe(1);
    expect(brier(1, 0)).toBe(1);
  });
  it('penalises distance from the truth quadratically', () => {
    expect(brier(0.5, 1)).toBeCloseTo(0.25);
    expect(brier(0.75, 1)).toBeCloseTo(0.0625);
  });
});

describe('scorePrediction', () => {
  it('credits a win when ODDIQ is closer to the outcome', () => {
    // Market said 40%, ODDIQ said 70%, YES happened.
    const s = scorePrediction(0.7, 0.4, 1);
    expect(s.verdict).toBe('beat');
    expect(s.aiCorrect).toBe(true);
    expect(s.aiBrier).toBeLessThan(s.marketBrier);
  });

  it('records a loss when the market is closer', () => {
    const s = scorePrediction(0.7, 0.4, 0);
    expect(s.verdict).toBe('lost');
    expect(s.aiCorrect).toBe(false);
  });

  // The defect this guards: agreeing with the market used to be scored as a
  // LOSS, which systematically understated the headline metric.
  it('treats agreeing with the market as a tie, not a loss', () => {
    const s = scorePrediction(0.42, 0.42, 1);
    expect(s.verdict).toBe('tie');
    expect(s.aiCorrect).toBe(false);
    expect(s.aiBrier).toBe(s.marketBrier);
  });

  it('treats float-noise-identical forecasts as a tie', () => {
    const s = scorePrediction(0.1 + 0.2, 0.30000000000000004, 1);
    expect(s.verdict).toBe('tie');
  });

  it('scores symmetrically regardless of outcome direction', () => {
    const yes = scorePrediction(0.8, 0.5, 1);
    const no = scorePrediction(0.2, 0.5, 0);
    expect(yes.verdict).toBe('beat');
    expect(no.verdict).toBe('beat');
    expect(yes.aiBrier).toBeCloseTo(no.aiBrier);
  });
});

describe('polymarketOutcomeFromPrice', () => {
  it('reads a settled YES', () => {
    expect(polymarketOutcomeFromPrice(true, 1)).toBe(1);
    expect(polymarketOutcomeFromPrice(true, 0.99)).toBe(1);
  });
  it('reads a settled NO', () => {
    expect(polymarketOutcomeFromPrice(true, 0)).toBe(0);
    expect(polymarketOutcomeFromPrice(true, 0.01)).toBe(0);
  });
  it('refuses to score an open market', () => {
    expect(polymarketOutcomeFromPrice(false, 0.98)).toBeNull();
  });

  // The defect this guards: a closed-but-unresolved market sitting mid-range
  // used to be recorded as NO, writing a wrong outcome into the record.
  it('refuses to score a closed market that has not settled', () => {
    expect(polymarketOutcomeFromPrice(true, 0.47)).toBeNull();
    expect(polymarketOutcomeFromPrice(true, 0.6)).toBeNull();
    expect(polymarketOutcomeFromPrice(true, 0.9)).toBeNull();
  });
  it('handles missing or junk prices', () => {
    expect(polymarketOutcomeFromPrice(true, null)).toBeNull();
    expect(polymarketOutcomeFromPrice(true, undefined)).toBeNull();
    expect(polymarketOutcomeFromPrice(true, NaN)).toBeNull();
  });
});

describe('isWorthResolving', () => {
  const now = new Date('2026-07-20T00:00:00Z');
  it('keeps polling recent predictions', () => {
    expect(isWorthResolving('2026-07-01T00:00:00Z', now)).toBe(true);
  });
  // The defect this guards: never-settling predictions used to fill the batch
  // forever, so newer predictions were never scored at all.
  it('gives up on predictions past the stale window', () => {
    const old = new Date(now.getTime() - (STALE_PREDICTION_DAYS + 1) * 86_400_000);
    expect(isWorthResolving(old, now)).toBe(false);
  });
  it('rejects unparseable timestamps rather than polling forever', () => {
    expect(isWorthResolving('not-a-date', now)).toBe(false);
  });
});
