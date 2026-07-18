import type { PlanTier } from '@/types';
import { RC_ENTITLEMENTS } from '@/data/subscriptions';
import type { SubscriptionService } from './index';

// Real RevenueCat implementation (react-native-purchases). Requires a native
// build (EAS dev client / TestFlight) - the SDK's native module doesn't exist
// in Expo Go, so the module is loaded lazily and callers fall back to the mock
// service when it isn't available.

// Minimal structural types for the parts of the SDK we use (avoids a hard
// compile-time dependency on the SDK's own types).
interface RCCustomerInfo {
  entitlements: { active: Record<string, unknown> };
}
interface RCPackage {
  identifier: string;
  product: { identifier: string };
}
interface RCPurchases {
  configure(opts: { apiKey: string }): void;
  getCustomerInfo(): Promise<RCCustomerInfo>;
  getOfferings(): Promise<{ current: { availablePackages: RCPackage[] } | null }>;
  purchasePackage(pkg: RCPackage): Promise<{ customerInfo: RCCustomerInfo }>;
  restorePurchases(): Promise<RCCustomerInfo>;
  logIn(appUserId: string): Promise<{ customerInfo: RCCustomerInfo }>;
}

/** Load the native SDK if present; null in Expo Go / web / tests. */
export function loadPurchasesModule(): RCPurchases | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-purchases');
    return (mod?.default ?? mod) as RCPurchases;
  } catch {
    return null;
  }
}

function tierFromInfo(info: RCCustomerInfo): PlanTier {
  const active = info.entitlements.active;
  if (RC_ENTITLEMENTS.trader in active) return 'trader';
  if (RC_ENTITLEMENTS.pro in active) return 'pro';
  return 'free';
}

// Product identifiers configured in App Store Connect / RevenueCat offerings.
const TIER_PRODUCT_PREFIX: Record<Exclude<PlanTier, 'free'>, string> = {
  pro: 'signal_pro',
  trader: 'signal_trader',
};

export class RevenueCatService implements SubscriptionService {
  private configured = false;

  constructor(
    private purchases: RCPurchases,
    private apiKey: string,
  ) {}

  private ensureConfigured() {
    if (!this.configured) {
      this.purchases.configure({ apiKey: this.apiKey });
      this.configured = true;
    }
  }

  /** Tie RevenueCat identity to the Supabase user id (call after sign-in). */
  async identify(appUserId: string): Promise<void> {
    this.ensureConfigured();
    await this.purchases.logIn(appUserId);
  }

  async getTier(): Promise<PlanTier> {
    this.ensureConfigured();
    const info = await this.purchases.getCustomerInfo();
    return tierFromInfo(info);
  }

  async purchase(tier: Exclude<PlanTier, 'free'>): Promise<PlanTier> {
    this.ensureConfigured();
    const offerings = await this.purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find((p) =>
      p.product.identifier.startsWith(TIER_PRODUCT_PREFIX[tier]),
    );
    if (!pkg) throw new Error(`No package found for tier "${tier}" in the current offering`);
    const { customerInfo } = await this.purchases.purchasePackage(pkg);
    return tierFromInfo(customerInfo);
  }

  async restore(): Promise<PlanTier> {
    this.ensureConfigured();
    const info = await this.purchases.restorePurchases();
    return tierFromInfo(info);
  }
}
