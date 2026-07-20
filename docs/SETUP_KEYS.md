# Signal — Keys & Setup Guide

The app runs fully on mock data with **zero keys**. To connect live services, provision the following. Ordered by impact.

---

## 1. Supabase (auth + database) — free tier fine to start

**What it unlocks:** real accounts, persisted profiles/watchlists/alerts, AI-analysis cache.

**Get it:**
1. Create a project at https://supabase.com → New Project (pick a region near your users).
2. **Settings → API** gives you three values:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL` and `app.json > extra.supabaseUrl`
   - **anon public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `app.json > extra.supabaseAnonKey`
   - **service_role key** → used **only** by the Edge Function (never in the app)
3. **SQL Editor** → paste and run [`supabase/schema.sql`](../supabase/schema.sql).
4. In `app.json`, set `extra.useMockData: false`.

**Cost:** Free tier (500 MB DB, 50k monthly active users). Paid Pro is $25/mo when you outgrow it.

---

## 2. AI analysis — OpenRouter (free) or Anthropic (direct)

**What it unlocks:** real AI-generated market analysis (bull/bear/why-changed/etc.). The Edge Function auto-selects its provider based on which secret you set. Either key lives **only** in the function, never in the app bundle.

### Option A — OpenRouter (free models) ← current choice
1. Create a key at https://openrouter.ai/keys.
2. Set it (and optionally pick a model):
   ```bash
   supabase secrets set OPENROUTER_API_KEY=sk-or-...
   supabase secrets set AI_MODEL=meta-llama/llama-3.3-70b-instruct:free   # optional; this is the default
   supabase functions deploy analyze-market
   ```
   Browse free models at https://openrouter.ai/models?max_price=0 (any `:free` id works). Swap `AI_MODEL` anytime — no redeploy needed for secret changes, but redeploy if you change code.

### Option B — Anthropic (direct, paid)
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...      # get one at console.anthropic.com
   supabase functions deploy analyze-market
   ```
   Uses `claude-sonnet-5` by default (override with `AI_MODEL`).

The function also needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, which Supabase injects automatically for deployed functions. Results are cached per market snapshot, so a given market is only analyzed once until it moves.

### Option C — News retrieval (gives the AI its edge)

Without a search key the AI reasons from price action alone (and says so). Add one free-tier search key so Pro/Trader analyses pull real news and cite it. Tavily is preferred; Brave is the fallback. You only need one.

```bash
supabase secrets set TAVILY_API_KEY=tvly-...     # tavily.com, ~1,000 free/mo — recommended
# or
supabase secrets set BRAVE_API_KEY=...           # brave.com/search/api, 2,000 free/mo
supabase functions deploy analyze-market
```

Retrieval is depth-gated to control cost: Free = no news (teaser only), Pro = ~5 results, Trader = ~8 with advanced search. News-backed analyses cache per day so they refresh as the story develops.

**Before deploying, add the two new `ai_analysis` columns** (SQL editor):
```sql
alter table ai_analysis add column if not exists edge text not null default '';
alter table ai_analysis add column if not exists sources jsonb not null default '[]';
```

---

## Production hardening (run before beta)

**1. Lock the paid product + add server-side quota** (SQL editor):
```sql
-- Stop the world from reading paid analyses with the public anon key
drop policy if exists "analysis readable" on ai_analysis;

-- Server-side daily quota table + atomic increment
create table if not exists ai_usage (
  user_id uuid not null references users(id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);
alter table ai_usage enable row level security;
create policy "own ai usage" on ai_usage for select using (auth.uid() = user_id);
create or replace function increment_ai_usage(p_user uuid) returns int
language plpgsql security definer as $$
declare c int; begin
  insert into ai_usage(user_id, day, count) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set count = ai_usage.count + 1
  returning count into c; return c; end $$;
```

**2. Deploy the new Edge Functions:**
```bash
npx supabase functions deploy analyze-market       # now auth + tier + quota enforced
npx supabase functions deploy delete-account       # App Store account deletion
npx supabase functions deploy revenuecat-webhook --no-verify-jwt
npx supabase secrets set RC_WEBHOOK_SECRET=<random>
```

**3. RevenueCat dashboard → Integrations → Webhooks:**
- URL: `https://aanhvekseyfsecezxgne.supabase.co/functions/v1/revenuecat-webhook`
- Authorization header value: the same `RC_WEBHOOK_SECRET`
- Entitlement identifiers must be `signal_pro` / `signal_trader`; configure the **3-day intro trial** on the offering (or the paywall copy is inaccurate → App Store rejection).

**4. Host legal pages** and update the URLs in `src/lib/legal.ts`:
`oddiq.ai/privacy`, `oddiq.ai/terms`. Apple requires reachable Privacy Policy + Terms links (they're wired into the paywall and Profile).

**5. Track record (the moat).** Add the tables/view (SQL editor):
```sql
-- run the ai_predictions + track_record + ai_usage blocks from schema.sql,
-- or the whole schema.sql if starting fresh
```
Then deploy the resolver and schedule it daily:
```bash
npx supabase functions deploy resolve-predictions --no-verify-jwt
```
```sql
select cron.schedule('resolve-predictions','17 3 * * *', $$
  select net.http_post(
    url:='https://aanhvekseyfsecezxgne.supabase.co/functions/v1/resolve-predictions',
    headers:='{"x-cron-secret":"YOUR_CRON_SECRET"}'::jsonb,
    timeout_milliseconds:=30000) $$);
```
**DONE — scheduled 2026-07-20** (migrations `20260720220000` + `20260720223000`), verified
live: `{"ok":true,"resolved":0}`. Three traps worth knowing if you ever re-do this:
- `--no-verify-jwt` is **not optional**. Without it the API gateway rejects the cron call
  with `UNAUTHORIZED_NO_AUTH_HEADER` before your code runs, and the CRON_SECRET check
  never even executes.
- `cron.job_run_details` reporting **`succeeded` means nothing** here — it only records that
  `net.http_post` was enqueued. The real result is in `net._http_response` (`status_code`,
  `content`). A job can "succeed" while 401ing forever. That is exactly how a stale
  `sync-markets` job sat there failing every 15 minutes unnoticed.
- pg_net's default timeout is **5s**, shorter than a full sync/resolve run, so responses
  land as NULL-status timeout rows even when the function completes. Pass
  `timeout_milliseconds` if you want to see the status.

Every real AI analysis now logs ODDIQ's probability vs the market's; the resolver scores them as markets settle. Read the rolling record from the `track_record` view — the app shows it (in the pre-signup sample + wherever surfaced) once ≥20 predictions have resolved.

---

## 3. Live Polymarket data — no key needed

**What it unlocks:** real markets instead of the 6 mock ones.

**Get it:** nothing to sign up for — the public Gamma API is used. Just set in `app.json`:
```json
"useMockData": false,
"useLiveData": true
```
`PolymarketSource` falls back to mock automatically if the API is unreachable.

---

## 4. RevenueCat (subscriptions) — free under $2.5k/mo revenue

**What it unlocks:** real in-app purchases for Pro ($19.99) / Trader ($99).

**Requires a native build** (not Expo Go) because IAP uses StoreKit.

**Get it:**
1. Create a project at https://app.revenuecat.com.
2. Add your iOS app; create **Entitlements** named exactly `signal_pro` and `signal_trader` (already referenced in [`data/subscriptions.ts`](../src/data/subscriptions.ts)).
3. Create products in **App Store Connect** ($19.99/mo, $99/mo) and attach them to offerings in RevenueCat.
4. Copy the **iOS public SDK key** → `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `app.json > extra.revenueCatIosKey`.
5. The native SDK (`react-native-purchases`) is already installed and wired:
   [`RevenueCatService`](../src/services/subscriptions/revenueCatService.ts) is
   selected **automatically** when (a) a real key is present and (b) the app is
   running in a native build. In Expo Go it silently falls back to the mock
   service, so nothing breaks during development. To exercise real purchases:
   ```bash
   eas build --profile development --platform ios   # dev client with the native module
   ```
   Products must be named `signal_pro*` / `signal_trader*` in the RevenueCat
   offering so the paywall can map tiers to packages. A `test_` key uses
   RevenueCat's Test Store (no App Store Connect needed) — ideal for the first
   dev-client run.

**Cost:** Free until $2,500/mo tracked revenue, then 1%.

---

## 5. Apple + EAS (build, push, TestFlight)

**What it unlocks:** a real installable build, TestFlight beta, and live push delivery.

**Get it:**
1. **Apple Developer Program** — https://developer.apple.com — **$99/year** (required for TestFlight + push).
2. **Expo account** (free) — `npx expo login`, then:
   ```bash
   npm i -g eas-cli
   eas build:configure          # links a project id
   eas build --profile preview --platform ios   # simulator/internal build
   eas build --profile production --platform ios # store build
   eas submit --platform ios     # upload to TestFlight
   ```
   Profiles are already defined in [`eas.json`](../eas.json).
3. **Push:** EAS manages the APNs key for you during build. On device, the app's "Enable push" flow (Profile tab) registers the Expo push token; the `users.expo_push_token` column stores it. To actually *send* alerts, add a scheduled job (Supabase cron / Edge Function) that watches `market_snapshots` for big moves and POSTs to `https://exp.host/--/api/v2/push/send`.

**Cost:** Apple $99/yr. EAS free tier covers low build volume; paid plans from $19/mo for more concurrency.

---

## Where each value goes (summary)

| Value | `.env` var | `app.json > extra` | Also needed by |
|---|---|---|---|
| Supabase URL | `EXPO_PUBLIC_SUPABASE_URL` | `supabaseUrl` | Edge Function (auto) |
| Supabase anon key | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `supabaseAnonKey` | — |
| Supabase service_role | — | — | Edge Function secret (auto) |
| Anthropic key | — | — | `supabase secrets set` |
| RevenueCat iOS key | `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | `revenueCatIosKey` | native build |
| Flags | — | `useMockData`, `useLiveData` | — |

Cheapest path to a live end-to-end demo (no IAP, no Apple account): **Supabase free + Anthropic pay-go + `useLiveData: true`**, run in Expo Go. Add RevenueCat + Apple only when you're ready for TestFlight.
