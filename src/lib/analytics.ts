import { getSupabase } from '@/lib/supabase';

// Minimal product analytics: fire-and-forget rows into the `events` table.
// No vendor, queryable in SQL. No-ops (console.log in dev) without Supabase.

export type FunnelEvent =
  | 'explain_click'
  | 'gated_impression'
  | 'analysis_viewed'
  | 'paywall_view'
  | 'plan_select'
  | 'purchase_start'
  | 'purchase_complete'
  | 'trial_start'
  | 'external_open';

let currentUserId: string | null = null;

/** Call on auth changes so events carry the user id. */
export function setAnalyticsUser(userId: string | null): void {
  currentUserId = userId;
}

/** Fire-and-forget event log. Never throws, never blocks UI. */
export function track(name: FunnelEvent, props: Record<string, unknown> = {}): void {
  const supabase = getSupabase();
  if (!supabase) {
    if (__DEV__) console.log(`[analytics] ${name}`, props);
    return;
  }
  void supabase
    .from('events')
    .insert({ user_id: currentUserId, name, props })
    .then(({ error }) => {
      if (error && __DEV__) console.log(`[analytics] failed: ${error.message}`);
    });
}
