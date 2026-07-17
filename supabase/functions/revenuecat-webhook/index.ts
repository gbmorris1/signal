// Supabase Edge Function: revenuecat-webhook
// Receives RevenueCat subscriber events and records the user's real tier in the
// `subscriptions` table (and mirrors to users.plan). This is what makes
// server-side entitlement enforcement in analyze-market trustworthy — the app
// can claim any tier, but only RevenueCat (via this webhook) sets the truth.
//
// Deploy:  supabase functions deploy revenuecat-webhook --no-verify-jwt
// Secret:  supabase secrets set RC_WEBHOOK_SECRET=<random>
// RevenueCat dashboard → Integrations → Webhooks:
//   URL          https://<ref>.supabase.co/functions/v1/revenuecat-webhook
//   Authorization header value = the same RC_WEBHOOK_SECRET
//
// The app calls Purchases.logIn(supabaseUserId), so event.app_user_id is the
// Supabase user id.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RC_WEBHOOK_SECRET = Deno.env.get('RC_WEBHOOK_SECRET') ?? '';

// Entitlement identifiers configured in RevenueCat (highest tier wins).
function planFromEntitlements(ids: string[]): 'free' | 'pro' | 'trader' {
  if (ids.includes('signal_trader')) return 'trader';
  if (ids.includes('signal_pro')) return 'pro';
  return 'free';
}

// Event types that mean the user currently has access (cancellation only turns
// off auto-renew — access persists until EXPIRATION).
const ACTIVE_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'CANCELLATION', // still active until it expires
]);

Deno.serve(async (req: Request) => {
  if (RC_WEBHOOK_SECRET && req.headers.get('Authorization') !== RC_WEBHOOK_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    const body = await req.json();
    event = body.event ?? body;
  } catch {
    return new Response('bad request', { status: 400 });
  }

  const appUserId = String(event.app_user_id ?? '');
  const type = String(event.type ?? '');
  const entitlementIds = Array.isArray(event.entitlement_ids)
    ? (event.entitlement_ids as string[])
    : [];
  if (!appUserId) return new Response('no app_user_id', { status: 400 });

  const active = ACTIVE_TYPES.has(type) && type !== 'EXPIRATION';
  const plan = active ? planFromEntitlements(entitlementIds) : 'free';

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const now = new Date().toISOString();
  const expMs = Number(event.expiration_at_ms ?? 0);

  const { error: subErr } = await supabase.from('subscriptions').upsert(
    {
      user_id: appUserId,
      plan,
      rc_app_user_id: appUserId,
      active,
      renews_at: expMs ? new Date(expMs).toISOString() : null,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );
  const { error: userErr } = await supabase.from('users').update({ plan }).eq('id', appUserId);

  if (subErr) console.error('subscription upsert error:', subErr.message);
  if (userErr) console.error('user plan update error:', userErr.message);

  return new Response(JSON.stringify({ ok: true, plan, active }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
