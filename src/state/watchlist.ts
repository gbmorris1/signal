import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/state/auth';
import { addWatch, listWatchlistIds, removeWatch } from '@/services/watchlist';
import type { Market } from '@/types';

const KEY = 'signal.watchlist.v1';

// Watchlist state. Keeps a local AsyncStorage copy for instant UX and demo/
// offline use, and mirrors changes to the `watchlists` table when signed in.
let memory: string[] = [];
const listeners = new Set<() => void>();

async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* ignore write errors in dev */
  }
  listeners.forEach((l) => l());
}

export function useWatchlist() {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const [ids, setIds] = useState<string[]>(memory);

  // Load: prefer the DB when signed in, else local storage.
  useEffect(() => {
    const update = () => setIds([...memory]);
    listeners.add(update);
    (async () => {
      if (userId) {
        const remote = await listWatchlistIds(userId);
        if (remote.length > 0) memory = remote;
      }
      if (memory.length === 0) {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) memory = JSON.parse(raw) as string[];
      }
      update();
    })();
    return () => {
      listeners.delete(update);
    };
  }, [userId]);

  const toggle = useCallback(
    (market: Market) => {
      const isOn = memory.includes(market.id);
      memory = isOn ? memory.filter((x) => x !== market.id) : [...memory, market.id];
      void persist();
      if (userId) {
        void (isOn ? removeWatch(userId, market.id) : addWatch(userId, market));
      }
    },
    [userId],
  );

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, has, toggle };
}
