import type { Market, MarketSnapshot, MarketDataSource } from '@/types';
import { MOCK_MARKETS, mockHistory } from '@/data/mockMarkets';

/** Local, key-free data source. Backs dev runs and tests. */
export class MockSource implements MarketDataSource {
  readonly platform = 'mock' as const;

  async listMarkets(params?: { category?: Market['category']; query?: string }): Promise<Market[]> {
    let out = [...MOCK_MARKETS];
    if (params?.category) out = out.filter((m) => m.category === params.category);
    if (params?.query) {
      const q = params.query.toLowerCase();
      out = out.filter((m) => m.title.toLowerCase().includes(q));
    }
    return out;
  }

  async getMarket(id: string): Promise<Market | null> {
    return MOCK_MARKETS.find((m) => m.id === id) ?? null;
  }

  async getHistory(id: string): Promise<MarketSnapshot[]> {
    return mockHistory(id);
  }
}
