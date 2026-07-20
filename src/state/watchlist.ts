import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/state/auth';
import { useEntitlement } from '@/state/entitlement';
import { addWatch, listWatchlistIds, removeWatch } from '@/services/watchlist';
import { resolveWatchlist, watchlistStorageKey } from '@/state/watchlistResolve';
import type { Market } from '@/types';

// Watchlist state. Keeps a per-account AsyncStorage copy for instant UX and
// offline/demo use, and mirrors changes to the `watchlists` table when signed
// in. `memory` is module-level so every mounted hook shares one list — which
// means it MUST be cleared when the account changes, or one user's watchlist
// leaks into the next session.
let memory: string[] = [];
/** Which account `memory` currently belongs to (undefined = nothing loaded). */
let loadedFor: string | null | undefined = undefined;
const listeners = new Set<() => void>();

async function readLocal(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function persist(userId: string | null) {
  try {
    await AsyncStorage.setItem(watchlistStorageKey(userId), JSON.stringify(memory));
  } catch {
    /* ignore write errors */
  }
  listeners.forEach((l) => l());
}

export function useWatchlist() {
  const { profile } = useAuth();
  const { entitlements } = useEntitlement();
  const userId = profile?.id ?? null;
  const [ids, setIds] = useState<string[]>(() => (loadedFor === userId ? memory : []));

  useEffect(() => {
    const update = () => setIds([...memory]);
    listeners.add(update);
    let cancelled = false;

    (async () => {
      // Never let the previous account's list show while the new one loads.
      if (loadedFor !== userId) {
        memory = [];
        update();
      }
      const local = await readLocal(watchlistStorageKey(userId));
      const remote = userId ? await listWatchlistIds(userId) : null;
      if (cancelled) return;
      memory = resolveWatchlist({ signedIn: !!userId, remote, local });
      loadedFor = userId;
      update();
    })();

    return () => {
      cancelled = true;
      listeners.delete(update);
    };
  }, [userId]);

  /** Returns false (and changes nothing) if adding would exceed the tier's cap. */
  const toggle = useCallback(
    (market: Market): boolean => {
      const isOn = memory.includes(market.id);
      if (!isOn && memory.length >= entitlements.watchlistLimit) return false;
      memory = isOn ? memory.filter((x) => x !== market.id) : [...memory, market.id];
      void persist(userId);
      if (userId) {
        void (isOn ? removeWatch(userId, market.id) : addWatch(userId, market));
      }
      return true;
    },
    [userId, entitlements.watchlistLimit],
  );

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, has, toggle };
}
