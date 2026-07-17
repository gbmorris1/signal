import { parseAIAnalysis } from '../schema';
import { snapshotHash } from '../index';
import { MOCK_MARKETS, mockHistory } from '@/data/mockMarkets';

describe('AI analysis schema', () => {
  it('parses a valid structured response', () => {
    const parsed = parseAIAnalysis({
      edge: 'price too low',
      summary: 's',
      bull_case: 'b',
      bear_case: 'be',
      why_changed: 'w',
      catalysts: ['c1'],
      risk_factors: [],
      confidence: 'high',
      ai_probability_estimate: 0.5,
      sources: [{ title: 'A', url: 'https://x.com', date: '2026-01-01' }],
    });
    expect(parsed.confidence).toBe('high');
    expect(parsed.catalysts).toEqual(['c1']);
    expect(parsed.edge).toBe('price too low');
    expect(parsed.sources[0].url).toBe('https://x.com');
  });

  it('defaults edge and sources when the model omits them', () => {
    const parsed = parseAIAnalysis({
      summary: 's',
      bull_case: 'b',
      bear_case: 'be',
      why_changed: 'w',
      confidence: 'low',
      ai_probability_estimate: null,
    });
    expect(parsed.edge).toBe('');
    expect(parsed.sources).toEqual([]);
  });

  it('coerces an out-of-range probability to null (tolerant parsing)', () => {
    const parsed = parseAIAnalysis({
      summary: 's',
      bull_case: 'b',
      bear_case: 'be',
      why_changed: 'w',
      confidence: 'low',
      ai_probability_estimate: 1.5,
    });
    expect(parsed.ai_probability_estimate).toBeNull();
  });
});

describe('snapshotHash', () => {
  it('is stable for identical inputs', () => {
    const m = MOCK_MARKETS[0];
    const h = mockHistory(m.id);
    expect(snapshotHash(m, h)).toBe(snapshotHash(m, h));
  });
});
