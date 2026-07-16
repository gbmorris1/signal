import Constants from 'expo-constants';
import type { MarketDataSource } from '@/types';
import { MockSource } from './mockSource';
import { PolymarketSource } from './polymarketSource';
import { KalshiSource } from './kalshiSource';
import { CombinedSource } from './combinedSource';

const useMock = Constants.expoConfig?.extra?.useMockData !== false;
const useLiveData = Constants.expoConfig?.extra?.useLiveData === true;

// Singleton so screen-level `useMemo(getMarketSource)` calls share caches.
let live: CombinedSource | null = null;

/**
 * Returns the active market data source.
 *  - live mode → CombinedSource(Polymarket + Kalshi), merged by volume
 *  - otherwise → MockSource
 */
export function getMarketSource(): MarketDataSource {
  if (useLiveData && !useMock) {
    if (!live) live = new CombinedSource([new PolymarketSource(), new KalshiSource()]);
    return live;
  }
  return new MockSource();
}

/** The combined source when live (exposes findComparables), else null. */
export function getCombinedSource(): CombinedSource | null {
  getMarketSource();
  return live;
}
