import {
  mapPolymarketMarket,
  mapCategory,
  deriveSignal,
  heuristicScore,
  type PolymarketRaw,
} from '../polymarketMap';

describe('mapPolymarketMarket', () => {
  const raw: PolymarketRaw = {
    id: 123,
    slug: 'fed-cut-sept',
    question: 'Will the Fed cut rates in September?',
    category: 'Finance',
    volumeNum: 4_820_000,
    outcomes: '["Yes","No"]',
    outcomePrices: '["0.43","0.57"]',
    oneDayPriceChange: 0.08,
    active: true,
    closed: false,
  };

  it('maps a live market into the Market shape', () => {
    const m = mapPolymarketMarket(raw)!;
    expect(m.id).toBe('polymarket:fed-cut-sept');
    expect(m.platform).toBe('polymarket');
    expect(m.probability).toBeCloseTo(0.43, 3);
    expect(m.change24h).toBeCloseTo(0.08, 3);
    expect(m.category).toBe('finance');
    expect(m.signal).toBe('opportunity');
  });

  it('drops closed markets', () => {
    expect(mapPolymarketMarket({ ...raw, closed: true })).toBeNull();
  });

  it('drops markets with no question', () => {
    expect(mapPolymarketMarket({ ...raw, question: undefined })).toBeNull();
  });

  it('clamps a malformed price to a valid probability', () => {
    const m = mapPolymarketMarket({ ...raw, outcomePrices: 'not-json' })!;
    expect(m.probability).toBeGreaterThan(0);
    expect(m.probability).toBeLessThanOrEqual(1);
  });
});

describe('category + signal helpers', () => {
  it('routes crypto keywords', () => {
    expect(mapCategory(undefined, 'Bitcoin above $100k?')).toBe('crypto');
  });
  it('routes politics keywords', () => {
    expect(mapCategory(undefined, 'Will Trump win the election?')).toBe('politics');
  });
  it('flags big liquid moves as opportunities', () => {
    expect(deriveSignal(0.07, 1_000_000)).toBe('opportunity');
  });
  it('scores movement and liquidity within 0..100', () => {
    const s = heuristicScore(0.1, 5_000_000);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});
