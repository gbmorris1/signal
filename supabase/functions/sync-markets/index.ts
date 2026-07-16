// Supabase Edge Function: sync-markets (scheduled)
// Syncs Polymarket markets into `markets`, records `market_snapshots`, detects
// significant moves vs the prior snapshot, writes `alerts` for users watching
// those markets, and sends Expo push notifications.
//
// Deploy:   supabase functions deploy sync-markets --no-verify-jwt
// Secret:   supabase secrets set CRON_SECRET=<random-string>
// Schedule (Supabase Dashboard → Database → Cron, or pg_cron):
//   select cron.schedule('sync-markets','*/15 * * * *', $$
//     select net.http_post(
//       url:='https://<ref>.functions.supabase.co/sync-markets',
//       headers:='{"x-cron-secret":"<random-string>"}'::jsonb) $$);
//
// Guarded by a shared CRON_SECRET header so it can't be triggered publicly.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

const MOVE_THRESHOLD = 0.05;
const AI_SHIFT_THRESHOLD = 0.08;
const GAMMA = 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=60&order=volume&ascending=false';

function num(v: unknown, d = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : d;
}

function mapCategory(input: string | undefined, q: string): string {
  const hay = `${input ?? ''} ${q}`.toLowerCase();
  if (/(fed|rate|inflation|cpi|gdp|stock|economy)/.test(hay)) return 'finance';
  if (/(bitcoin|btc|eth|crypto|solana|token)/.test(hay)) return 'crypto';
  if (/(election|president|senate|trump|poll|vote)/.test(hay)) return 'politics';
  if (/(nba|nfl|mlb|soccer|ufc|olympic|world cup)/.test(hay)) return 'sports';
  if (/(ai|openai|chip|tech|software|apple|google)/.test(hay)) return 'technology';
  return 'world';
}

interface Detected {
  kind: 'move' | 'ai_shift';
  title: string;
  body: string;
}
function detectMove(marketTitle: string, prior: number, current: number): Detected | null {
  const delta = current - prior;
  if (Math.abs(delta) < MOVE_THRESHOLD) return null;
  const pts = Math.round(delta * 100);
  const isBig = Math.abs(delta) >= AI_SHIFT_THRESHOLD;
  if (isBig) {
    return {
      kind: 'ai_shift',
      title: 'AI detected a major market shift',
      body: `${marketTitle} moved from ${Math.round(prior * 100)}% to ${Math.round(current * 100)}%.`,
    };
  }
  return {
    kind: 'move',
    title: `${marketTitle} probability moved ${Math.abs(pts)}%`,
    body: `Now ${Math.round(current * 100)}% (${pts >= 0 ? '+' : ''}${pts} points).`,
  };
}

async function sendPush(tokens: string[], title: string, body: string) {
  if (tokens.length === 0) return;
  const messages = tokens.map((to) => ({ to, title, body, sound: 'default' }));
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
}

Deno.serve(async (req: Request) => {
  // Auth: require the shared cron secret.
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1) Fetch live markets.
  let raw: Array<Record<string, unknown>>;
  try {
    const res = await fetch(GAMMA);
    raw = await res.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: `gamma fetch: ${e}` }), { status: 502 });
  }

  let synced = 0;
  let alertsCreated = 0;

  for (const m of raw) {
    const question = String(m.question ?? '').trim();
    if (!question || m.closed) continue;
    const prices = (() => {
      try {
        return (JSON.parse(String(m.outcomePrices ?? '[]')) as string[]).map((p) => num(p));
      } catch {
        return [];
      }
    })();
    if (prices.length === 0) continue;

    const external = String(m.slug ?? m.id ?? question);
    const id = `polymarket:${external}`;
    const probability = Math.min(0.999, Math.max(0.001, prices[0]));
    const volume = num(m.volumeNum ?? m.volume);
    const category = mapCategory(m.category as string | undefined, question);

    // Prior snapshot for move detection.
    const { data: prev } = await supabase
      .from('market_snapshots')
      .select('probability')
      .eq('market_id', id)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Upsert catalog row + record snapshot.
    await supabase.from('markets').upsert(
      {
        id,
        external_id: external,
        platform: 'polymarket',
        title: question,
        category,
        probability,
        change_24h: num(m.oneDayPriceChange),
        volume,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    await supabase.from('market_snapshots').insert({ market_id: id, probability, volume });
    synced++;

    // Move detection → alerts for watchers.
    if (prev) {
      const hit = detectMove(question, num(prev.probability), probability);
      if (hit) {
        const { data: watchers } = await supabase
          .from('watchlists')
          .select('user_id, users(expo_push_token)')
          .eq('market_id', id);

        if (watchers && watchers.length > 0) {
          const rows = watchers.map((w: { user_id: string }) => ({
            user_id: w.user_id,
            market_id: id,
            kind: hit.kind,
            title: hit.title,
            body: hit.body,
          }));
          await supabase.from('alerts').insert(rows);
          alertsCreated += rows.length;

          const tokens = watchers
            .map((w: { users?: { expo_push_token?: string } | null }) => w.users?.expo_push_token)
            .filter((t): t is string => !!t);
          await sendPush(tokens, hit.title, hit.body);
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, synced, alertsCreated }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
