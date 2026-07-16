// Supabase Edge Function: analyze-market
// Generates structured AI analysis for a prediction market. Supports two
// providers, chosen by which secret is set:
//   • OpenRouter (default) — OpenAI-compatible, has free models
//   • Anthropic (direct)   — used automatically if only ANTHROPIC_API_KEY is set
// Results are cached in `ai_analysis` keyed by a snapshot hash so we never
// regenerate for an unchanged market.
//
// Deploy:  supabase functions deploy analyze-market
// Secrets (pick one provider):
//   supabase secrets set OPENROUTER_API_KEY=sk-or-...
//   supabase secrets set AI_MODEL=meta-llama/llama-3.3-70b-instruct:free   # optional
//   — or —
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Request body: { market: Market, history?: MarketSnapshot[] }
// Response:     structured analysis JSON

import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') ?? '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Provider selection: OpenRouter wins if its key is present.
const PROVIDER: 'openrouter' | 'anthropic' = OPENROUTER_API_KEY ? 'openrouter' : 'anthropic';
const AI_MODEL_ENV = Deno.env.get('AI_MODEL');

// Free models rotate through heavy upstream rate limits, so we try a list in
// order and fall through on 429. Set AI_MODEL to pin a single model instead.
// Verified free instruct models (OpenRouter slugs change often — refresh from
// https://openrouter.ai/api/v1/models if these 404). Ordered by preference.
const FREE_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'google/gemma-4-31b-it:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
];
const OPENROUTER_MODELS = AI_MODEL_ENV ? [AI_MODEL_ENV] : FREE_MODELS;
const ANTHROPIC_MODEL = AI_MODEL_ENV ?? 'claude-sonnet-5';

interface Market {
  id: string;
  title: string;
  category: string;
  probability: number;
  change24h: number;
  volume: number;
}

function snapshotHash(m: Market): string {
  return `${m.id}:${m.probability.toFixed(3)}:${m.change24h.toFixed(3)}`;
}

const SYSTEM = `You are a prediction-market analyst. Given a market, its current
implied probability, 24h change, and volume, produce concise, neutral, non-advisory
analysis. You are not giving financial advice. Respond with ONLY a JSON object of shape:
{
  "summary": string,
  "bull_case": string,
  "bear_case": string,
  "why_changed": string,
  "catalysts": string[],
  "risk_factors": string[],
  "confidence": "low" | "medium" | "high",
  "ai_probability_estimate": number  // your own 0..1 estimate
}
No prose outside the JSON.`;

function userPrompt(m: Market): string {
  return [
    `Market: "${m.title}"`,
    `Category: ${m.category}`,
    `Current implied probability (YES): ${(m.probability * 100).toFixed(1)}%`,
    `24h change: ${(m.change24h * 100).toFixed(1)} points`,
    `Volume: $${Math.round(m.volume).toLocaleString()}`,
    ``,
    `Analyze why the market may have moved and lay out the bull/bear cases.`,
  ].join('\n');
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Call the configured provider and return the raw model text. */
async function callModel(market: Market): Promise<string> {
  if (PROVIDER === 'openrouter') {
    let lastErr = 'no models tried';
    // Try each candidate model; fall through on rate-limit (429).
    for (const model of OPENROUTER_MODELS) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://signal.app',
          'X-Title': 'Signal',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          temperature: 0.4,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: userPrompt(market) },
          ],
        }),
      });
      if (res.ok) {
        const json = await res.json();
        return json?.choices?.[0]?.message?.content ?? '{}';
      }
      const body = await res.text();
      lastErr = `openrouter ${res.status} (${model}): ${body}`;
      // Fall through when a model is busy or unavailable (rate-limited, provider
      // down, retired slug); hard-fail on real errors (auth, bad request).
      if (![429, 503, 404, 502].includes(res.status)) throw new Error(lastErr);
    }
    throw new Error(`no free model available. last: ${lastErr}`);
  }

  // Anthropic direct
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt(market) }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json?.content?.[0]?.text ?? '{}';
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);
  if (!OPENROUTER_API_KEY && !ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'no AI provider key configured' }, 500);
  }

  let market: Market;
  try {
    const body = await req.json();
    market = body.market;
    if (!market?.id || !market?.title) throw new Error('missing market');
  } catch {
    return jsonResponse({ error: 'invalid body' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const hash = snapshotHash(market);

  // 1) Cache hit?
  const { data: cached, error: readErr } = await supabase
    .from('ai_analysis')
    .select('*')
    .eq('market_id', market.id)
    .eq('snapshot_hash', hash)
    .maybeSingle();

  if (cached) {
    return jsonResponse({
      summary: cached.summary,
      bull_case: cached.bull_case,
      bear_case: cached.bear_case,
      why_changed: cached.why_changed,
      catalysts: cached.catalysts,
      risk_factors: cached.risk_factors,
      confidence: cached.confidence,
      ai_probability_estimate: cached.ai_probability_estimate,
    });
  }

  // 2) Call the model.
  let text: string;
  try {
    text = await callModel(market);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 502);
  }

  let parsed: Record<string, unknown>;
  try {
    // Models may wrap JSON in prose/code fences; extract the object.
    const match = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : text);
  } catch {
    return jsonResponse({ error: 'model returned non-JSON', raw: text.slice(0, 400) }, 502);
  }

  // 3) Ensure the market exists in the catalog (ai_analysis has a FK to markets).
  //    Live markets come from the Polymarket API, so we upsert on demand here.
  const platform = market.id.startsWith('kalshi:') ? 'kalshi' : 'polymarket';
  const externalId = market.id.includes(':')
    ? market.id.slice(market.id.indexOf(':') + 1)
    : market.id;
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

  // 4) Persist analysis to cache.
  const { error: writeErr } = await supabase.from('ai_analysis').upsert(
    {
      market_id: market.id,
      snapshot_hash: hash,
      summary: parsed.summary ?? '',
      bull_case: parsed.bull_case ?? '',
      bear_case: parsed.bear_case ?? '',
      why_changed: parsed.why_changed ?? '',
      catalysts: parsed.catalysts ?? [],
      risk_factors: parsed.risk_factors ?? [],
      confidence: parsed.confidence ?? 'medium',
      ai_probability_estimate: parsed.ai_probability_estimate ?? null,
    },
    { onConflict: 'market_id,snapshot_hash' },
  );

  // Log cache-write problems server-side (visible in `supabase functions logs`)
  // without failing the request — analysis still returns to the client.
  if (readErr) console.error('cache read error:', readErr.message);
  if (marketErr) console.error('market upsert error:', marketErr.message);
  if (writeErr) console.error('analysis upsert error:', writeErr.message);

  return jsonResponse(parsed);
});
