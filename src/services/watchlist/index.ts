import { getSupabase } from '@/lib/supabase';
import type { Market } from '@/types';

/**
 * DB-backed watchlist operations. No-ops when Supabase isn't configured (the
 * hook keeps a local AsyncStorage copy for instant UX + demo mode).
 */

export async function listWatchlistIds(userId: string): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from('watchlists').select('market_id').eq('user_id', userId);
  if (error || !data) return [];
  return data.map((r: { market_id: string }) => r.market_id);
}

/** Add a market to the watchlist, ensuring the market row exists first (FK). */
export async function addWatch(userId: string, market: Market): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  // Ensure the market exists in the catalog (watchlists.market_id → markets.id).
  await supabase.from('markets').upsert(
    {
      id: market.id,
      external_id: market.externalId,
      platform: market.platform,
      title: market.title,
      category: market.category,
      probability: market.probability,
      change_24h: market.change24h,
      volume: market.volume,
      ai_score: market.aiScore,
      signal: market.signal,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  await supabase.from('watchlists').upsert(
    { user_id: userId, market_id: market.id },
    { onConflict: 'user_id,market_id' },
  );
}

export async function removeWatch(userId: string, marketId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('watchlists').delete().eq('user_id', userId).eq('market_id', marketId);
}
