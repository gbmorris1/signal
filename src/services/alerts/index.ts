import { getSupabase } from '@/lib/supabase';
import { MOCK_ALERTS } from '@/data/mockAlerts';
import type { Alert } from '@/types';

interface AlertRow {
  id: number;
  market_id: string;
  kind: Alert['kind'];
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

/**
 * Fetch a user's alerts. Reads the `alerts` table when signed in against a live
 * Supabase project; otherwise returns mock alerts so the screen is populated in
 * demo/dev.
 */
export async function fetchAlerts(userId: string | null): Promise<Alert[]> {
  const supabase = getSupabase();
  if (!supabase || !userId) return MOCK_ALERTS;

  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) return MOCK_ALERTS;
  if (data.length === 0) return MOCK_ALERTS; // keep the screen illustrative until real alerts arrive

  return (data as AlertRow[]).map((r) => ({
    id: String(r.id),
    marketId: r.market_id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    read: r.read,
    createdAt: r.created_at,
  }));
}

export async function markAlertRead(userId: string, alertId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('alerts').update({ read: true }).eq('user_id', userId).eq('id', alertId);
}
