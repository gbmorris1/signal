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

// Scoring rules mirror src/lib/scoring.ts, which is the tested source of
// truth (Deno functions can't import app code). Change both together.
const STALE_PREDICTION_DAYS = 180;

// Returns 1 (YES occurred), 0 (NO), or null (not settled yet).
async function polymarketOutcome(externalId: string): Promise<number | null> {
  try {
    const res = await fetch(`${GAMMA}/markets?slug=${encodeURIComponent(externalId)}`);
    if (!res.ok) return null;
    const arr = await res.json();
    const m = Array.isArray(arr) ? arr[0] : null;
    if (!m || !m.closed) return null;
    const prices = JSON.parse(m.outcomePrices ?? '[]').map(Number);
    const yes = prices[0];
    if (!Number.isFinite(yes)) return null;
    // `closed` is NOT enough: a market can be closed while resolution is still
    // pending, with the YES price sitting mid-range. Only score a decisively
    // settled price, otherwise we write a wrong outcome into a permanent record.
    if (yes >= 0.95) return 1;
    if (yes <= 0.05) return 0;
    return null;
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

  // Batch: distinct unresolved markets, oldest first — but only within the
  // stale window. Markets that never settle (delisted, voided) would otherwise
  // permanently occupy the batch and newer predictions would never be scored.
  const staleCutoff = new Date(Date.now() - STALE_PREDICTION_DAYS * 86_400_000).toISOString();
  const { data: rows } = await supabase
    .from('ai_predictions')
    .select('id, market_id, ai_probability, market_probability')
    .eq('resolved', false)
    .gte('created_at', staleCutoff)
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
      // A tie is a PUSH, not a loss: when the model simply agrees with the
      // market there's no forecasting skill to credit either way. Scoring ties
      // as losses systematically understated the headline metric.
      const tie = Math.abs(aiBrier - mktBrier) < 1e-9;
      await supabase
        .from('ai_predictions')
        .update({
          resolved: true,
          outcome,
          resolved_at: new Date().toISOString(),
          ai_brier: aiBrier,
          market_brier: mktBrier,
          ai_correct: !tie && aiBrier < mktBrier,
          verdict: tie ? 'tie' : aiBrier < mktBrier ? 'beat' : 'lost',
        })
        .eq('id', p.id);
      resolved++;
    }
  }

  return new Response(JSON.stringify({ ok: true, resolved }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
