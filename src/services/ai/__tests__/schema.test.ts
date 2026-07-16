import { parseAIAnalysis } from '../schema';
import { snapshotHash } from '../index';
import { MOCK_MARKETS, mockHistory } from '@/data/mockMarkets';

describe('AI analysis schema', () => {
  it('parses a valid structured response', () => {
    const parsed = parseAIAnalysis({
      summary: 's',
      bull_case: 'b',
      bear_case: 'be',
      why_changed: 'w',
      catalysts: ['c1'],
      risk_factors: [],
      confidence: 'high',
      ai_probability_estimate: 0.5,
    });
    expect(parsed.confidence).toBe('high');
    expect(parsed.catalysts).toEqual(['c1']);
  });

  it('rejects an out-of-range probability', () => {
    expect(() =>
      parseAIAnalysis({
        summary: 's',
        bull_case: 'b',
        bear_case: 'be',
        why_changed: 'w',
        confidence: 'low',
        ai_probability_estimate: 1.5,
      }),
    ).toThrow();
  });
});

describe('snapshotHash', () => {
  it('is stable for identical inputs', () => {
    const m = MOCK_MARKETS[0];
    const h = mockHistory(m.id);
    expect(snapshotHash(m, h)).toBe(snapshotHash(m, h));
  });
});
