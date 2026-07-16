import { recommendFeed, scoreMarket } from '../recommend';
import { MOCK_MARKETS } from '@/data/mockMarkets';

describe('recommendFeed', () => {
  it('ranks interest-matched markets above off-interest ones, all else equal', () => {
    const finance = MOCK_MARKETS.find((m) => m.category === 'finance')!;
    const sByInterest = scoreMarket(finance, ['finance'], 'active');
    const sNoInterest = scoreMarket(finance, ['sports'], 'active');
    expect(sByInterest).toBeGreaterThan(sNoInterest);
  });

  it('returns every market (filtering happens elsewhere)', () => {
    const feed = recommendFeed({ markets: MOCK_MARKETS, interests: ['crypto'], experience: 'beginner' });
    expect(feed).toHaveLength(MOCK_MARKETS.length);
  });

  it('professional weighting favors bigger movers than beginner weighting', () => {
    const mover = { ...MOCK_MARKETS[0], change24h: 0.14, aiScore: 50, volume: 1_000_000 };
    const pro = scoreMarket(mover, [], 'professional');
    const beg = scoreMarket(mover, [], 'beginner');
    expect(pro).toBeGreaterThan(beg);
  });
});
