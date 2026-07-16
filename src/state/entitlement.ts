import { useCallback, useEffect, useState } from 'react';
import type { PlanTier } from '@/types';
import { getSubscriptionService } from '@/services/subscriptions';
import { entitlementsFor, type Entitlements } from '@/services/subscriptions/entitlements';

/**
 * Live entitlement for the current user. Reads the subscription service (mock or
 * RevenueCat) and exposes the derived feature limits plus purchase/restore.
 */
export function useEntitlement() {
  const [tier, setTier] = useState<PlanTier>('free');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const svc = getSubscriptionService();
      setTier(await svc.getTier());
    } catch {
      setTier('free'); // store unreachable / not configured → safe default
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const purchase = useCallback(
    async (t: Exclude<PlanTier, 'free'>) => {
      const svc = getSubscriptionService();
      const granted = await svc.purchase(t);
      setTier(granted);
      return granted;
    },
    [],
  );

  const restore = useCallback(async () => {
    const svc = getSubscriptionService();
    const t = await svc.restore();
    setTier(t);
    return t;
  }, []);

  const entitlements: Entitlements = entitlementsFor(tier);
  return { tier, entitlements, loading, purchase, restore, refresh };
}
