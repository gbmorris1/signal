import { getSupabase } from '@/lib/supabase';
import type { Market } from '@/types';

/**
 * DB-backed watchlist operations. No-ops when Supabase isn't configured (the
 * hook keeps a local AsyncStorage copy for instant UX + demo mode).
 */

/**
 * Watched market ids for a user.
 *
 * Returns `null` when the read FAILED, and `[]` when the user genuinely has an
 * empty watchlist. Collapsing those two cases is what let one account's list
 * bleed into the next, so callers must keep them apart.
 */
export async function listWatchlistIds(userId: string): Promise<string[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('watchlists')
    .select('market_id')
    .eq('user_id', userId);
  if (error || !data) return null;
  return data.map((r: { market_id: string }) => r.market_id);
}

/**
 * Add a market to the watchlist. Deliberately does NOT try to write the
 * `markets` catalog: that table is RLS select-only for clients, so the write
 * always failed silently and (while market_id was still a foreign key) took the
 * watch down with it. Returns false if the write didn't stick.
 */
export async function addWatch(userId: string, market: Market): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from('watchlists')
    .upsert({ user_id: userId, market_id: market.id }, { onConflict: 'user_id,market_id' });
  if (error) {
    console.warn('addWatch failed:', error.message);
    return false;
  }
  return true;
}

export async function removeWatch(userId: string, marketId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from('watchlists')
    .delete()
    .eq('user_id', userId)
    .eq('market_id', marketId);
  if (error) {
    console.warn('removeWatch failed:', error.message);
    return false;
  }
  return true;
}
