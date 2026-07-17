// Supabase Edge Function: analyze-market
// Generates opinionated, news-grounded AI analysis for a prediction market.
//
// Retrieval + generation are separated so cost stays low:
//   • Web/news context via Tavily (preferred) or Brave (fallback) free tiers.
//     Retrieval is depth-gated: shallow = none, standard = ~5, deep = ~8.
//   • Generation via OpenRouter (free models) or Anthropic (if only that key
//     is set). Depth controls token budget + how strong an opinion we demand.
//
// Deploy:  supabase functions deploy analyze-market
// Secrets:
//   supabase secrets set OPENROUTER_API_KEY=sk-or-...        # or ANTHROPIC_API_KEY
//   supabase secrets set TAVILY_API_KEY=tvly-...             # or BRAVE_API_KEY
//   supabase secrets set AI_MODEL=...                        # optional, pins model
//
// Request body: { market, history?, depth? }
// Response:     structured analysis JSON incl. `edge` and `sources`

import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') ?? '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY') ?? '';
const BRAVE_API_KEY = Deno.env.get('BRAVE_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PROVIDER: 'openrouter' | 'anthropic' = OPENROUTER_API_KEY ? 'openrouter' : 'anthropic';
const AI_MODEL_ENV = Deno.env.get('AI_MODEL');

// OpenRouter's free-tier catalog rotates — verify against
// https://openrouter.ai/api/v1/models (ids ending ':free') before changing.
// Avoid "reasoning" models here: they spend the token budget on chain-of-
// thought monologue and can get cut off before ever emitting the JSON object,
// which is exactly what nemotron-3-ultra/nano-omni-reasoning did at shallow
// depth's 500-token cap. Plain instruct models go straight to the answer.
const FREE_MODELS = [
  'tencent/hy3:free',
  'poolside/laguna-m.1:free',
  'poolside/laguna-xs-2.1:free',
  'cohere/north-mini-code:free',
];
const OPENROUTER_MODELS = AI_MODEL_ENV ? [AI_MODEL_ENV] : FREE_MODELS;
const ANTHROPIC_MODEL = AI_MODEL_ENV ?? 'claude-sonnet-5';

type Depth = 'shallow' | 'standard' | 'deep';
const DEPTH_CONFIG: Record<Depth, { maxTokens: number; results: number; extra: string }> = {
  shallow: {
    maxTokens: 500,
    results: 0, // no retrieval — the free-tier teaser
    extra: 'Keep every field to ONE short sentence; max 2 catalysts and 2 risk_factors. Edge is one sentence.',
  },
  standard: {
    maxTokens: 1800,
    results: 5,
    extra: 'Keep edge to ~3 sentences, summary/bull_case/bear_case to 2 sentences each, max 4 catalysts and 4 risk_factors.',
  },
  deep: {
    maxTokens: 3400,
    results: 8,
    extra:
      'Go deeper: 3-4 sentences for bull_case/bear_case, cover second-order effects, up to 6 catalysts with rough timing. The edge is a sharp, contrarian-where-justified 3-4 sentence thesis with explicit conviction.',
  },
};
function asDepth(v: unknown): Depth {
  return v === 'shallow' || v === 'deep' ? v : 'standard';
}

// Server-authoritative tier → allowed depth + daily analysis cap. The client
// cannot exceed these by sending a bigger `depth` or resetting a local counter.
type Tier = 'free' | 'pro' | 'trader';
const TIER_LIMITS: Record<Tier, { depth: Depth; daily: number }> = {
  free: { depth: 'shallow', daily: 1 },
  pro: { depth: 'standard', daily: 25 },
  trader: { depth: 'deep', daily: 100000 },
};
const DEPTH_RANK: Record<Depth, number> = { shallow: 0, standard: 1, deep: 2 };
function clampDepth(requested: Depth, allowed: Depth): Depth {
  return DEPTH_RANK[requested] <= DEPTH_RANK[allowed] ? requested : allowed;
}

interface Market {
  id: string;
  title: string;
  category: string;
  probability: number;
  change24h: number;
  volume: number;
}
interface Snapshot {
  probability: number;
  capturedAt?: string;
}
interface Source {
  title: string;
  url: string;
  snippet: string;
  date?: string;
}

// News-backed analysis should refresh as news moves. Bucket the cache by day
// for retrieval-backed depths; shallow (no news) caches purely by snapshot.
function snapshotHash(m: Market, depth: Depth): string {
  const day = depth === 'shallow' ? '' : `:${new Date().toISOString().slice(0, 10)}`;
  return `${m.id}:${m.probability.toFixed(3)}:${m.change24h.toFixed(3)}:${depth}${day}`;
}

// ── Retrieval ────────────────────────────────────────────────────────────────

/** Search query: the question, minus boilerplate, plus a recency nudge. */
function buildQuery(m: Market): string {
  const q = m.title.replace(/^will\s+/i, '').replace(/\?+$/, '').trim();
  return q.length > 8 ? q : m.title;
}

async function fetchContext(m: Market, depth: Depth): Promise<Source[]> {
  const n = DEPTH_CONFIG[depth].results;
  if (n === 0) return [];
  const query = buildQuery(m);

  try {
    if (TAVILY_API_KEY) {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query,
          topic: 'news',
          search_depth: depth === 'deep' ? 'advanced' : 'basic',
          max_results: n,
          include_answer: false,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        return (json.results ?? []).slice(0, n).map((r: Record<string, unknown>) => ({
          title: String(r.title ?? ''),
          url: String(r.url ?? ''),
          snippet: String(r.content ?? '').slice(0, 500),
          date: r.published_date ? String(r.published_date).slice(0, 10) : undefined,
        }));
      }
    }
    if (BRAVE_API_KEY) {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(query)}&count=${n}`,
        { headers: { 'X-Subscription-Token': BRAVE_API_KEY, Accept: 'application/json' } },
      );
      if (res.ok) {
        const json = await res.json();
        return (json.results ?? []).slice(0, n).map((r: Record<string, unknown>) => ({
          title: String(r.title ?? ''),
          url: String(r.url ?? ''),
          snippet: String(r.description ?? '').slice(0, 500),
          date: typeof r.age === 'string' ? r.age : undefined,
        }));
      }
    }
  } catch (e) {
    console.error('context fetch failed:', String(e));
  }
  return [];
}

// ── Prompting ────────────────────────────────────────────────────────────────

const SYSTEM = `You are ODDIQ's lead analyst. Prediction-market traders pay you
for an EDGE: a concrete, defensible opinion that a smart reader couldn't get by
glancing at the price. Not a summary. A view.

You are given the market, its price action, and (when available) numbered news
sources. Your job:
- Form a clear directional read: is the market's implied probability too high,
  too low, or fair? Say so plainly and commit to it in "edge".
- Ground every claim in the sources or in verifiable base rates / scheduled
  events you know. Cite sources inline as [1], [2] (ASCII square brackets only)
  matching the list.
- Keep it tight. Return valid, complete JSON — do not run long and get cut off.
- NEVER invent a news event. If the sources don't explain a move, say what the
  price action alone implies and flag the uncertainty.
- Be specific: real names, real dates, real mechanisms. No "sentiment shifted".
- "edge" is the headline take — the one paragraph a trader reads first. State
  your lean vs the market, your conviction, and what would change your mind.
- Neutral, non-advisory framing. Analysis, not financial advice.

Respond with ONLY a JSON object:
{
  "edge": string,               // the opinionated headline thesis (with [n] cites)
  "summary": string,            // what this market is + your read
  "bull_case": string,          // strongest concrete case for YES
  "bear_case": string,          // strongest concrete case for NO
  "why_changed": string,        // what the recent move reflects
  "catalysts": string[],        // upcoming things to watch, with timing
  "risk_factors": string[],
  "confidence": "low" | "medium" | "high",
  "ai_probability_estimate": number  // your independent 0..1 estimate
}
No prose outside the JSON.`;

function trendLine(history: Snapshot[] | undefined): string {
  if (!history || history.length < 2) return 'No price history available.';
  const pts = history.filter((h) => Number.isFinite(h.probability)).map((h) => Math.round(h.probability * 100));
  if (pts.length < 2) return 'No price history available.';
  const step = Math.max(1, Math.floor(pts.length / 12));
  const sampled = pts.filter((_, i) => i % step === 0);
  return `Past-week trajectory (%, oldest→newest): ${sampled.join(' → ')} (range ${Math.min(...pts)}–${Math.max(...pts)}%)`;
}

function sourceBlock(sources: Source[]): string {
  if (sources.length === 0) {
    return 'NEWS SOURCES: none available — reason from price action and known base rates only.';
  }
  const lines = sources.map(
    (s, i) => `[${i + 1}] ${s.title}${s.date ? ` (${s.date})` : ''}\n${s.snippet}`,
  );
  return `NEWS SOURCES (cite as [n]):\n${lines.join('\n\n')}`;
}

function userPrompt(m: Market, history: Snapshot[] | undefined, sources: Source[]): string {
  return [
    `Market: "${m.title}"`,
    `Platform: ${m.id.split(':')[0]} · Category: ${m.category}`,
    `Current implied probability (YES): ${(m.probability * 100).toFixed(1)}%`,
    `24h change: ${(m.change24h * 100).toFixed(1)} points · Volume: $${Math.round(m.volume).toLocaleString()}`,
    trendLine(history),
    `Today's date: ${new Date().toISOString().slice(0, 10)}`,
    ``,
    sourceBlock(sources),
    ``,
    `Give ODDIQ's edge on this market: is the price wrong, and why?`,
  ].join('\n');
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * Tolerant JSON extraction from model output. Handles code fences, full-width
 * 【n】 citation brackets, and — critically — responses truncated by the token
 * limit, by closing any open string/array/object so a partial answer still
 * parses instead of falling back to canned text.
 */
function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/【/g, '[')
    .replace(/】/g, ']');
  const start = cleaned.indexOf('{');
  if (start < 0) return null;
  const body = cleaned.slice(start);

  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  const direct = tryParse(body);
  if (direct) return direct;

  // Repair a truncated tail: close an open string, then unclosed [ and {.
  let inStr = false;
  let esc = false;
  let depthObj = 0;
  let depthArr = 0;
  for (const c of body) {
    if (esc) {
      esc = false;
      continue;
    }
    if (c === '\\') {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === '{') depthObj++;
    else if (c === '}') depthObj--;
    else if (c === '[') depthArr++;
    else if (c === ']') depthArr--;
  }
  let repaired = body.replace(/,\s*$/, '');
  if (inStr) repaired += '"';
  repaired += ']'.repeat(Math.max(0, depthArr)) + '}'.repeat(Math.max(0, depthObj));
  return tryParse(repaired);
}

// ── Generation ───────────────────────────────────────────────────────────────

async function callModel(
  market: Market,
  history: Snapshot[] | undefined,
  sources: Source[],
  depth: Depth,
): Promise<string> {
  const cfg = DEPTH_CONFIG[depth];
  const system = SYSTEM + (cfg.extra ? `\n\nDEPTH: ${cfg.extra}` : '');
  const user = userPrompt(market, history, sources);

  if (PROVIDER === 'openrouter') {
    let lastErr = 'no models tried';
    for (const model of OPENROUTER_MODELS) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://oddiq.ai',
          'X-Title': 'ODDIQ',
        },
        body: JSON.stringify({
          model,
          max_tokens: cfg.maxTokens,
          temperature: 0.5,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (res.ok) {
        const json = await res.json();
        return json?.choices?.[0]?.message?.content ?? '{}';
      }
      lastErr = `openrouter ${res.status} (${model}): ${await res.text()}`;
      if (![429, 503, 404, 502].includes(res.status)) throw new Error(lastErr);
    }
    throw new Error(`no free model available. last: ${lastErr}`);
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: cfg.maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json?.content?.[0]?.text ?? '{}';
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);
  if (!OPENROUTER_API_KEY && !ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'no AI provider key configured' }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Authenticate the caller (closes the "anyone with the anon key" hole) ──
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: userData } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401);

  // ── Server-authoritative tier (RevenueCat webhook → subscriptions) ──
  const [{ data: sub }, { data: prof }] = await Promise.all([
    supabase.from('subscriptions').select('plan, active').eq('user_id', user.id).maybeSingle(),
    supabase.from('users').select('plan').eq('id', user.id).maybeSingle(),
  ]);
  const tier: Tier = ((sub?.active && sub.plan) || prof?.plan || 'free') as Tier;
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

  let market: Market;
  let history: Snapshot[] | undefined;
  let depth: Depth = 'standard';
  try {
    const body = await req.json();
    market = body.market;
    history = Array.isArray(body.history) ? body.history : undefined;
    depth = clampDepth(asDepth(body.depth), limits.depth); // never deeper than tier
    if (!market?.id || !market?.title) throw new Error('missing market');
  } catch {
    return jsonResponse({ error: 'invalid body' }, 400);
  }

  const hash = snapshotHash(market, depth);

  // 1) Cache hit?
  const { data: cached, error: readErr } = await supabase
    .from('ai_analysis')
    .select('*')
    .eq('market_id', market.id)
    .eq('snapshot_hash', hash)
    .maybeSingle();

  if (cached) {
    // Cache hits are free — no model call, so they don't spend quota.
    return jsonResponse({
      edge: cached.edge ?? '',
      summary: cached.summary,
      bull_case: cached.bull_case,
      bear_case: cached.bear_case,
      why_changed: cached.why_changed,
      catalysts: cached.catalysts,
      risk_factors: cached.risk_factors,
      confidence: cached.confidence,
      ai_probability_estimate: cached.ai_probability_estimate,
      sources: cached.sources ?? [],
      tier,
    });
  }

  // 2) Enforce the server-side daily quota BEFORE spending any model/search cost.
  const { data: usage } = await supabase
    .from('ai_usage')
    .select('count')
    .eq('user_id', user.id)
    .eq('day', new Date().toISOString().slice(0, 10))
    .maybeSingle();
  if ((usage?.count ?? 0) >= limits.daily) {
    // Over limit → return a teaser from any cached analysis for this market
    // (never a fresh model call), plus the upgrade signal.
    const { data: any } = await supabase
      .from('ai_analysis')
      .select('edge, summary')
      .eq('market_id', market.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const teaserSrc = (any?.edge || any?.summary || '').trim();
    const teaser = teaserSrc ? teaserSrc.split(/(?<=[.!?])\s/)[0] : '';
    return jsonResponse({ gated: true, tier, daily: limits.daily, teaser }, 200);
  }

  // 3) Retrieve news context (depth-gated), then generate.
  const sources = await fetchContext(market, depth);

  let text: string;
  try {
    text = await callModel(market, history, sources, depth);
  } catch (e) {
    console.error('analyze-market: model call failed:', String(e));
    return jsonResponse({ error: String(e) }, 502);
  }

  const parsed = extractJson(text);
  if (!parsed || !parsed.summary) {
    console.error('analyze-market: model returned non-JSON:', text.slice(0, 400));
    return jsonResponse({ error: 'model returned non-JSON', raw: text.slice(0, 400) }, 502);
  }

  // Attach the REAL sources we retrieved (never trust model-authored URLs).
  const publicSources = sources.map((s) => ({ title: s.title, url: s.url, date: s.date ?? null }));

  // 3) Ensure the market exists (ai_analysis FK), then cache.
  const platform = market.id.startsWith('kalshi:') ? 'kalshi' : 'polymarket';
  const externalId = market.id.includes(':') ? market.id.slice(market.id.indexOf(':') + 1) : market.id;
  const { error: marketErr } = await supabase.from('markets').upsert(
    {
      id: market.id,
      external_id: externalId,
      platform,
      title: market.title,
      category: market.category,
      probability: market.probability,
      change_24h: market.change24h,
      volume: market.volume,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  const { error: writeErr } = await supabase.from('ai_analysis').upsert(
    {
      market_id: market.id,
      snapshot_hash: hash,
      edge: parsed.edge ?? '',
      summary: parsed.summary ?? '',
      bull_case: parsed.bull_case ?? '',
      bear_case: parsed.bear_case ?? '',
      why_changed: parsed.why_changed ?? '',
      catalysts: parsed.catalysts ?? [],
      risk_factors: parsed.risk_factors ?? [],
      confidence: parsed.confidence ?? 'medium',
      ai_probability_estimate: parsed.ai_probability_estimate ?? null,
      sources: publicSources,
    },
    { onConflict: 'market_id,snapshot_hash' },
  );

  // 4) Log the prediction for the track record (only real generations, and
  //    only when the model gave a usable probability estimate).
  const est = typeof parsed.ai_probability_estimate === 'number' ? parsed.ai_probability_estimate : null;
  if (est != null) {
    const gap = est - market.probability;
    const direction = gap > 0.03 ? 'higher' : gap < -0.03 ? 'lower' : 'inline';
    await supabase.from('ai_predictions').insert({
      market_id: market.id,
      title: market.title,
      category: market.category,
      ai_probability: est,
      market_probability: market.probability,
      edge_gap: gap,
      direction,
      depth,
    });
  }

  // 5) Charge the user's daily quota (only a real generation counts).
  const { error: usageErr } = await supabase.rpc('increment_ai_usage', { p_user: user.id });

  if (readErr) console.error('cache read error:', readErr.message);
  if (marketErr) console.error('market upsert error:', marketErr.message);
  if (writeErr) console.error('analysis upsert error:', writeErr.message);
  if (usageErr) console.error('usage increment error:', usageErr.message);

  return jsonResponse({ ...parsed, sources: publicSources, tier });
});
