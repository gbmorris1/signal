import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlanTier } from '@/types';

const STORE_KEY = 'signal.entitlement.v1';
const rcKey = Constants.expoConfig?.extra?.revenueCatIosKey as string | undefined;

/** True when a real RevenueCat public key is configured. */
export const hasRevenueCat = !!rcKey && !rcKey.includes('PLACEHOLDER');

export interface SubscriptionService {
  /** Current entitlement tier. */
  getTier(): Promise<PlanTier>;
  /** Purchase a paid tier; resolves to the granted tier. */
  purchase(tier: Exclude<PlanTier, 'free'>): Promise<PlanTier>;
  /** Restore prior purchases. */
  restore(): Promise<PlanTier>;
  /** Tie the store identity to the app's user id (so the RC webhook maps to it). */
  identify?(appUserId: string): Promise<void>;
}

/**
 * Mock subscription service. Persists the chosen tier locally so the paywall and
 * feature-gating flows are fully exercisable without a native build or store
 * account. Swap for `RevenueCatService` (react-native-purchases) in a dev/prod
 * client; the interface and `useEntitlement` hook stay identical.
 */
class MockSubscriptionService implements SubscriptionService {
  async getTier(): Promise<PlanTier> {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    return (raw as PlanTier | null) ?? 'free';
  }
  async purchase(tier: Exclude<PlanTier, 'free'>): Promise<PlanTier> {
    await AsyncStorage.setItem(STORE_KEY, tier);
    return tier;
  }
  async restore(): Promise<PlanTier> {
    return this.getTier();
  }
}

let instance: SubscriptionService | null = null;

/**
 * Returns the active subscription service:
 *  - RevenueCatService when a real key is configured AND the native SDK module
 *    is present (EAS dev client / TestFlight build)
 *  - MockSubscriptionService otherwise (Expo Go, tests, no key)
 */
export function getSubscriptionService(): SubscriptionService {
  if (instance) return instance;
  if (hasRevenueCat && rcKey) {
    // Lazy import avoids a hard dependency cycle and keeps Expo Go working.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { loadPurchasesModule, RevenueCatService } = require('./revenueCatService') as
      typeof import('./revenueCatService');
    const purchases = loadPurchasesModule();
    if (purchases) {
      instance = new RevenueCatService(purchases, rcKey);
      return instance;
    }
  }
  instance = new MockSubscriptionService();
  return instance;
}
