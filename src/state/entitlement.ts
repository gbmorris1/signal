import { useCallback, useEffect, useState } from 'react';
import type { PlanTier } from '@/types';
import { getSubscriptionService, hasRevenueCat } from '@/services/subscriptions';
import { entitlementsFor, type Entitlements } from '@/services/subscriptions/entitlements';
import { useAuth } from '@/state/auth';

/**
 * Live entitlement for the current user.
 *  - When RevenueCat is configured (production), tier comes from RevenueCat.
 *  - Until then, tier comes from the server-side `users.plan` on the profile
 *    (set by the RevenueCat webhook, or manually for testing). This keeps the
 *    app's gating aligned with the server's enforcement without RevenueCat.
 */
export function useEntitlement() {
  const { profile } = useAuth();
  const [rcTier, setRcTier] = useState<PlanTier>('free');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!hasRevenueCat) {
      setLoading(false);
      return;
    }
    try {
      setRcTier(await getSubscriptionService().getTier());
    } catch {
      setRcTier('free');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const tier: PlanTier = hasRevenueCat ? rcTier : profile?.plan ?? 'free';

  const purchase = useCallback(async (t: Exclude<PlanTier, 'free'>) => {
    const granted = await getSubscriptionService().purchase(t);
    setRcTier(granted);
    return granted;
  }, []);

  const restore = useCallback(async () => {
    const t = await getSubscriptionService().restore();
    setRcTier(t);
    return t;
  }, []);

  const entitlements: Entitlements = entitlementsFor(tier);
  return { tier, entitlements, loading, purchase, restore, refresh };
}
