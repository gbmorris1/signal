// Supabase Edge Function: sync-markets (scheduled)
// Syncs Polymarket AND Kalshi markets into `markets`, records `market_snapshots`,
// detects significant probability moves and unusual-volume surges vs recent
// snapshots, writes `alerts` for Pro+ users watching those markets, and sends
// Expo push notifications.
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

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

const MOVE_THRESHOLD = 0.05;
const AI_SHIFT_THRESHOLD = 0.08;
// Unusual-volume: the latest ~15-min interval moved >= BASELINE_MULT× the MEDIAN of
// this market's own recent intervals.
//
// Calibrated 2026-07-20 against 89k live snapshots. The previous rule (>=4× the single
// prior interval AND >=15% of cumulative volume) was measurably broken on both terms:
//
//   • `prevDelta` was <= 0 in 98% of intervals, and `curDelta >= 4 * 0` is vacuously
//     true, so the multiplier gated nothing — ~91% of fires came through that branch.
//   • Fraction-of-cumulative doesn't survive contact with market age. Lifetime volume
//     grows without bound, so the same 15-min burst scores ~100× lower on a six-month-old
//     market than a day-old one. Measured: Polymarket's p98 of curDelta/cumulative is
//     0.0039, so the 0.15 threshold could essentially never fire there (6 hits in 3 days),
//     while on Kalshi it sat below p90 and fired constantly. One constant, both failure
//     modes, different venues.
//
// A median of the market's OWN recent intervals is self-normalizing: it's scale-free
// across venues (USD vs contracts) and across market age, which no single ratio is.
// Measured curDelta/median on Polymarket (the source with correct cumulative data):
// p90 = 8.1, p98 = 33.3. BASELINE_MULT sits just above p90 — deliberately nearer the
// quiet end, since a false push is far more costly than a missed one.
const VOLUME_BASELINE_MULT = 12;
const VOLUME_BASELINE_MIN_SAMPLES = 4;

const GAMMA =
  'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=60&order=volume&ascending=false';
const KALSHI = 'https://api.elections.kalshi.com/trade-api/v2/events?limit=200&status=open&with_nested_markets=true';
// Match the app's Kalshi curation (see src/services/markets/kalshiMap.ts) so
// alert market ids line up with what users actually watch.
const KALSHI_MIN_VOLUME = 25;
const KALSHI_MIN_LEG_PROB = 0.02;
const KALSHI_MAX_LEGS = 3;

// Alerts are a Pro+ feature (server-authoritative, mirrors analyze-market's
// tier resolution: an active `subscriptions` row wins, else `users.plan`).
function alertsEnabledForPlan(plan: string): boolean {
  return plan === 'pro' || plan === 'trader';
}

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

interface NormMarket {
  id: string;
  external: string;
  platform: 'polymarket' | 'kalshi';
  title: string;
  category: string;
  probability: number;
  change24h: number;
  /**
   * Display + curation volume. MUST stay the same quantity the app curates on
   * (see src/services/markets/kalshiMap.ts) or synced markets drift out of sync
   * with what users actually see, and alerts fire for markets not in the app.
   */
  volume: number;
  /**
   * Lifetime-cumulative volume, for the `market_snapshots` series only. Kept
   * separate because it is a DIFFERENT quantity from `volume` on Kalshi (rolling
   * 24h vs lifetime) and spike detection requires a monotonically increasing
   * series to difference. Conflating the two is what broke the old rule.
   */
  volumeCumulative: number;
}

interface Detected {
  kind: 'move' | 'ai_shift' | 'volume_spike';
  title: string;
  body: string;
}

function detectMove(title: string, prior: number, current: number): Detected | null {
  const delta = current - prior;
  if (Math.abs(delta) < MOVE_THRESHOLD) return null;
  const pts = Math.round(delta * 100);
  if (Math.abs(delta) >= AI_SHIFT_THRESHOLD) {
    return {
      kind: 'ai_shift',
      title: 'AI detected a major market shift',
      body: `${title} moved from ${Math.round(prior * 100)}% to ${Math.round(current * 100)}%.`,
    };
  }
  return {
    kind: 'move',
    title: `${title} probability moved ${Math.abs(pts)}%`,
    body: `Now ${Math.round(current * 100)}% (${pts >= 0 ? '+' : ''}${pts} points).`,
  };
}

// ── MIRROR of src/lib/volumeSpike.ts ─────────────────────────────────────────
// That module is the TESTED source of truth (17 tests, incl. regressions for the
// vacuous-multiplier, market-age, rolling-window and restatement defects). Deno
// can't import app code, so the logic is duplicated here verbatim — the same
// arrangement scoring.ts ↔ resolve-predictions uses. CHANGE BOTH TOGETHER.
// A test asserts the constants below match; it does not compare the bodies.

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function intervalDeltas(priorVolsNewestFirst: number[]): number[] {
  const out: number[] = [];
  for (let i = priorVolsNewestFirst.length - 1; i > 0; i--) {
    const d = priorVolsNewestFirst[i - 1] - priorVolsNewestFirst[i];
    if (Number.isFinite(d)) out.push(d);
  }
  return out;
}

/** True when the newest interval is anomalous for THIS market. */
function isVolumeSpike(current: number, priorVolsNewestFirst: number[]): boolean {
  const prev0 = priorVolsNewestFirst[0];
  const curDelta = current - prev0;
  if (!(prev0 > 0)) return false;
  if (!(curDelta > 0)) return false;

  const deltas = intervalDeltas(priorVolsNewestFirst);
  // A market that just entered the top-N by volume has no history. Staying silent
  // beats guessing at what's normal for it.
  if (deltas.length < VOLUME_BASELINE_MIN_SAMPLES) return false;

  // Only positive intervals describe trading activity; zero-volume windows would
  // drag the median to 0 and make every subsequent trade look like a spike.
  const baseline = median(deltas.filter((d) => d > 0));
  if (!(baseline > 0)) return false;

  // A single interval cannot legitimately exceed the market's entire prior lifetime
  // volume. Rejects tiny-denominator noise and venue-side restatements of the series
  // (e.g. the Kalshi rolling→cumulative switch, which manufactures one enormous
  // delta and would otherwise alert every Kalshi market at once).
  if (curDelta > prev0) return false;
  return curDelta / baseline >= VOLUME_BASELINE_MULT;
}
// ── end mirror ───────────────────────────────────────────────────────────────

/**
 * Cumulative volumes, most-recent-prior first. BOTH sources must supply a
 * lifetime-cumulative figure (see fetchKalshi) or the deltas are meaningless.
 */
function detectVolumeSpike(
  title: string,
  current: number,
  prob: number,
  priorVols: number[],
): Detected | null {
  if (!isVolumeSpike(current, priorVols)) return null;
  return {
    kind: 'volume_spike',
    title: `Unusual volume on ${title}`,
    body: `A surge of trading just hit this market, now at ${Math.round(prob * 100)}%.`,
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

/** Insert alerts + push for the Pro+ users watching a market. Returns count created. */
async function dispatchAlert(
  supabase: SupabaseClient,
  marketId: string,
  hit: Detected,
): Promise<number> {
  const { data: watchers } = await supabase
    .from('watchlists')
    .select('user_id, users(expo_push_token, plan)')
    .eq('market_id', marketId);
  if (!watchers || watchers.length === 0) return 0;

  type Watcher = { user_id: string; users?: { expo_push_token?: string; plan?: string } | null };
  const userIds = (watchers as Watcher[]).map((w) => w.user_id);
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('user_id, plan, active')
    .in('user_id', userIds);
  const subByUser = new Map(
    (subs ?? []).map((s: { user_id: string; plan: string; active: boolean }) => [s.user_id, s]),
  );

  const eligible = (watchers as Watcher[]).filter((w) => {
    const sub = subByUser.get(w.user_id);
    const plan = (sub?.active && sub.plan) || w.users?.plan || 'free';
    return alertsEnabledForPlan(plan);
  });
  if (eligible.length === 0) return 0;

  const rows = eligible.map((w) => ({
    user_id: w.user_id,
    market_id: marketId,
    kind: hit.kind,
    title: hit.title,
    body: hit.body,
  }));
  await supabase.from('alerts').insert(rows);

  const tokens = eligible
    .map((w) => w.users?.expo_push_token)
    .filter((t): t is string => !!t);
  await sendPush(tokens, hit.title, hit.body);
  return rows.length;
}

/** Upsert one market, record a snapshot, and fire the single most important alert. */
async function processMarket(supabase: SupabaseClient, m: NormMarket): Promise<number> {
  // Prior snapshots, newest first: [0] for move detection, the whole window for the
  // volume baseline (which needs enough intervals to take a meaningful median).
  const { data: prev } = await supabase
    .from('market_snapshots')
    .select('probability, volume')
    .eq('market_id', m.id)
    .order('captured_at', { ascending: false })
    .limit(12);

  await supabase.from('markets').upsert(
    {
      id: m.id,
      external_id: m.external,
      platform: m.platform,
      title: m.title,
      category: m.category,
      probability: m.probability,
      change_24h: m.change24h,
      volume: m.volume,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  await supabase.from('market_snapshots').insert({
    market_id: m.id,
    probability: m.probability,
    // Cumulative, NOT the display volume — this column is a time series that only
    // detectVolumeSpike reads, and differencing it requires a monotonic quantity.
    volume: m.volumeCumulative,
  });

  const priors = (prev ?? []) as Array<{ probability: number; volume: number }>;
  if (priors.length === 0) return 0;

  const moveHit = detectMove(m.title, num(priors[0].probability), m.probability);
  const volHit = detectVolumeSpike(
    m.title,
    m.volumeCumulative,
    m.probability,
    priors.map((p) => num(p.volume)),
  );
  // Priority: a major shift is the headline; else a volume surge; else a move.
  const hit = moveHit?.kind === 'ai_shift' ? moveHit : (volHit ?? moveHit);
  if (!hit) return 0;
  return dispatchAlert(supabase, m.id, hit);
}

// ── Polymarket ────────────────────────────────────────────────────────────────
async function fetchPolymarket(): Promise<NormMarket[]> {
  const res = await fetch(GAMMA);
  const raw = (await res.json()) as Array<Record<string, unknown>>;
  const out: NormMarket[] = [];
  for (const m of raw) {
    const question = String(m.question ?? '').trim();
    if (!question || m.closed) continue;
    let prices: number[] = [];
    try {
      prices = (JSON.parse(String(m.outcomePrices ?? '[]')) as string[]).map((p) => num(p));
    } catch {
      continue;
    }
    if (prices.length === 0) continue;
    const external = String(m.slug ?? m.id ?? question);
    out.push({
      id: `polymarket:${external}`,
      external,
      platform: 'polymarket',
      title: question,
      category: mapCategory(m.category as string | undefined, question),
      probability: Math.min(0.999, Math.max(0.001, prices[0])),
      change24h: num(m.oneDayPriceChange),
      // Polymarket's Gamma `volume` is already lifetime-cumulative, so display and
      // series are the same figure here. Kalshi is where the two diverge.
      volume: num(m.volumeNum ?? m.volume),
      volumeCumulative: num(m.volumeNum ?? m.volume),
    });
  }
  return out;
}

// ── Kalshi (nested markets under events; mirrors the app's curation) ────────────
function dollars(v: unknown): number | null {
  const n = num(v, NaN);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

async function fetchKalshi(): Promise<NormMarket[]> {
  const res = await fetch(KALSHI);
  if (!res.ok) throw new Error(`kalshi ${res.status}`);
  const json = (await res.json()) as { events?: Array<Record<string, unknown>> };
  const out: NormMarket[] = [];
  for (const e of json.events ?? []) {
    const eventTitle = String(e.title ?? '').trim();
    const markets = (e.markets ?? []) as Array<Record<string, unknown>>;
    const legs: NormMarket[] = [];
    for (const raw of markets) {
      if (raw.status && raw.status !== 'active') continue;
      const ticker = String(raw.ticker ?? '').trim();
      if (!eventTitle || !ticker) continue;
      const last = dollars(raw.last_price_dollars);
      const bid = dollars(raw.yes_bid_dollars);
      const ask = dollars(raw.yes_ask_dollars);
      const hasBook = bid != null && ask != null && bid > 0 && ask < 1;
      const spread = hasBook ? (ask as number) - (bid as number) : 1;
      const mid = hasBook ? ((bid as number) + (ask as number)) / 2 : null;
      const probability = mid != null && spread <= 0.15 ? mid : last && last > 0 ? last : mid;
      if (probability == null || probability <= 0) continue;
      const prev = dollars(raw.previous_price_dollars);
      // Two DIFFERENT quantities, deliberately kept apart:
      //   volume_24h_fp — rolling 24h window. The right "what's hot now" figure, and
      //     what the app curates/sorts on, so it stays the display + curation volume.
      //   volume_fp     — lifetime cumulative. The only one valid for the snapshot
      //     series, because spike detection differences consecutive values.
      // The old code fed the rolling figure to both, which silently broke detection:
      // a rolling window goes DOWN as old trades age out, so interval deltas are
      // routinely negative — 552 negative deltas on Kalshi vs 0 on Polymarket is what
      // exposed it. Verified live on one market: volume_fp = 112950.78 vs
      // volume_24h_fp = 367.63.
      const volume = num(raw.volume_24h_fp) || num(raw.volume_fp);
      const volumeCumulative = num(raw.volume_fp) || volume;
      if (volume < KALSHI_MIN_VOLUME) continue;
      const clamped = Math.min(0.999, Math.max(0.001, probability));
      const sub = String(raw.yes_sub_title ?? '').trim();
      const multi = markets.length > 1;
      legs.push({
        id: `kalshi:${ticker}`,
        external: ticker,
        platform: 'kalshi',
        title: multi && sub ? `${eventTitle} · ${sub}` : eventTitle,
        category: mapCategory(e.category as string | undefined, eventTitle),
        probability: clamped,
        change24h: prev != null && prev > 0 ? clamped - prev : 0,
        volume,
        volumeCumulative,
      });
    }
    if (legs.length <= 1) {
      out.push(...legs);
    } else {
      out.push(
        ...legs
          .filter((l) => l.probability >= KALSHI_MIN_LEG_PROB)
          .sort((a, b) => b.volume - a.volume)
          .slice(0, KALSHI_MAX_LEGS),
      );
    }
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Polymarket is the primary source - a failure here fails the run.
  let markets: NormMarket[];
  try {
    markets = await fetchPolymarket();
  } catch (e) {
    return new Response(JSON.stringify({ error: `polymarket fetch: ${e}` }), { status: 502 });
  }

  // Kalshi is additive - never let it break the Polymarket sync.
  let kalshiCount = 0;
  try {
    const k = await fetchKalshi();
    kalshiCount = k.length;
    markets = markets.concat(k);
  } catch (e) {
    console.error('kalshi sync skipped:', String(e));
  }

  let synced = 0;
  let alertsCreated = 0;
  for (const m of markets) {
    try {
      alertsCreated += await processMarket(supabase, m);
      synced++;
    } catch (e) {
      console.error(`processMarket ${m.id} failed:`, String(e));
    }
  }

  return new Response(
    JSON.stringify({ ok: true, synced, kalshi: kalshiCount, alertsCreated }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
