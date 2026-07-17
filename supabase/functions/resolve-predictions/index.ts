// Supabase Edge Function: resolve-predictions (scheduled)
// Scores ODDIQ's track record: finds unresolved ai_predictions whose market has
// settled on the source platform, records the outcome, and computes whether
// ODDIQ's probability beat the market's (Brier scores).
//
// Deploy:   supabase functions deploy resolve-predictions --no-verify-jwt
// Secret:   reuses CRON_SECRET
// Schedule (daily is plenty):
//   select cron.schedule('resolve-predictions','17 3 * * *', $$
//     select net.http_post(
//       url:='https://<ref>.supabase.co/functions/v1/resolve-predictions',
//       headers:='{"x-cron-secret":"<secret>"}'::jsonb) $$);

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

const GAMMA = 'https://gamma-api.polymarket.com';
const KALSHI = 'https://api.elections.kalshi.com/trade-api/v2';

// Returns 1 (YES occurred), 0 (NO), or null (not resolved yet).
async function polymarketOutcome(externalId: string): Promise<number | null> {
  try {
    const res = await fetch(`${GAMMA}/markets?slug=${encodeURIComponent(externalId)}`);
    if (!res.ok) return null;
    const arr = await res.json();
    const m = Array.isArray(arr) ? arr[0] : null;
    if (!m || !m.closed) return null;
    const prices = JSON.parse(m.outcomePrices ?? '[]').map(Number);
    if (prices.length < 1) return null;
    // On resolution Polymarket sets the YES price to 1 or 0.
    return prices[0] >= 0.5 ? 1 : 0;
  } catch {
    return null;
  }
}

async function kalshiOutcome(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(`${KALSHI}/markets/${encodeURIComponent(ticker)}`);
    if (!res.ok) return null;
    const json = await res.json();
    const m = json.market;
    if (!m || m.status !== 'settled') return null;
    if (m.result === 'yes') return 1;
    if (m.result === 'no') return 0;
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Batch: distinct unresolved markets, oldest first.
  const { data: rows } = await supabase
    .from('ai_predictions')
    .select('id, market_id, ai_probability, market_probability')
    .eq('resolved', false)
    .order('created_at', { ascending: true })
    .limit(300);
  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, resolved: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Resolve one lookup per distinct market, then apply to all its predictions.
  const byMarket = new Map<string, typeof rows>();
  for (const r of rows) byMarket.set(r.market_id, [...(byMarket.get(r.market_id) ?? []), r]);

  let resolved = 0;
  for (const [marketId, preds] of byMarket) {
    const [platform, ...rest] = marketId.split(':');
    const externalId = rest.join(':');
    const outcome =
      platform === 'kalshi'
        ? await kalshiOutcome(externalId)
        : await polymarketOutcome(externalId);
    if (outcome == null) continue;

    for (const p of preds) {
      const aiBrier = (p.ai_probability - outcome) ** 2;
      const mktBrier = (p.market_probability - outcome) ** 2;
      await supabase
        .from('ai_predictions')
        .update({
          resolved: true,
          outcome,
          resolved_at: new Date().toISOString(),
          ai_brier: aiBrier,
          market_brier: mktBrier,
          ai_correct: aiBrier < mktBrier, // ODDIQ closer to the truth than the market
        })
        .eq('id', p.id);
      resolved++;
    }
  }

  return new Response(JSON.stringify({ ok: true, resolved }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
