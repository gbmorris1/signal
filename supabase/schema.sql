-- Signal — PostgreSQL schema (Supabase)
-- Run in Supabase SQL editor or via `supabase db push`.
-- Row Level Security is enabled; users can only see their own rows where applicable.

-- ── Enums ───────────────────────────────────────────────────────────────────
create type platform      as enum ('polymarket', 'kalshi');
create type category      as enum ('politics', 'finance', 'crypto', 'sports', 'world', 'technology');
create type ai_signal     as enum ('opportunity', 'watch', 'neutral', 'caution');
create type confidence    as enum ('low', 'medium', 'high');
create type plan_tier     as enum ('free', 'pro', 'trader');
create type alert_kind    as enum ('move', 'ai_shift');
create type experience_level as enum ('beginner', 'active', 'professional');

-- ── users (profile, 1:1 with auth.users) ────────────────────────────────────
create table if not exists users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  interests    category[] not null default '{}',
  experience   experience_level not null default 'beginner',
  onboarded    boolean not null default false,
  expo_push_token text,
  plan         plan_tier  not null default 'free',
  created_at   timestamptz not null default now()
);

-- ── markets ─────────────────────────────────────────────────────────────────
create table if not exists markets (
  id             text primary key,               -- stable id, e.g. 'polymarket:0xabc'
  external_id    text not null,                  -- id on source platform
  platform       platform not null,
  title          text not null,
  category       category not null,
  probability    numeric not null,               -- 0..1 current YES probability
  change_24h     numeric not null default 0,     -- delta over last 24h (probability points)
  volume         numeric not null default 0,
  ai_score       numeric,                        -- 0..100, nullable until scored
  signal         ai_signal not null default 'neutral',
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index if not exists markets_category_idx on markets(category);
create index if not exists markets_change_idx   on markets(change_24h desc);
create index if not exists markets_score_idx    on markets(ai_score desc nulls last);

-- ── market_snapshots (probability history) ──────────────────────────────────
create table if not exists market_snapshots (
  id           bigserial primary key,
  market_id    text not null references markets(id) on delete cascade,
  probability  numeric not null,
  volume       numeric not null default 0,
  captured_at  timestamptz not null default now()
);
create index if not exists snapshots_market_time_idx on market_snapshots(market_id, captured_at desc);

-- ── ai_analysis (cached Claude output) ──────────────────────────────────────
create table if not exists ai_analysis (
  id                    bigserial primary key,
  market_id             text not null references markets(id) on delete cascade,
  snapshot_hash         text not null,           -- hash of inputs; dedupes regeneration
  edge                  text not null default '',-- the opinionated headline thesis
  summary               text not null,
  bull_case             text not null,
  bear_case             text not null,
  why_changed           text not null,
  catalysts             text[] not null default '{}',
  risk_factors          text[] not null default '{}',
  confidence            confidence not null,
  ai_probability_estimate numeric,               -- 0..1
  sources               jsonb not null default '[]', -- [{title,url,date}] retrieved news
  created_at            timestamptz not null default now(),
  unique (market_id, snapshot_hash)
);

-- If ai_analysis already exists from an earlier deploy, add the new columns:
--   alter table ai_analysis add column if not exists edge text not null default '';
--   alter table ai_analysis add column if not exists sources jsonb not null default '[]';

-- ── watchlists ──────────────────────────────────────────────────────────────
create table if not exists watchlists (
  user_id    uuid not null references users(id) on delete cascade,
  market_id  text not null references markets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, market_id)
);

-- ── alerts ──────────────────────────────────────────────────────────────────
create table if not exists alerts (
  id         bigserial primary key,
  user_id    uuid not null references users(id) on delete cascade,
  market_id  text not null references markets(id) on delete cascade,
  kind       alert_kind not null,
  title      text not null,
  body       text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists alerts_user_time_idx on alerts(user_id, created_at desc);

-- ── subscriptions (mirror of RevenueCat entitlement) ────────────────────────
create table if not exists subscriptions (
  user_id     uuid primary key references users(id) on delete cascade,
  plan        plan_tier not null default 'free',
  rc_app_user_id text,                            -- RevenueCat app user id
  active      boolean not null default false,
  renews_at   timestamptz,
  updated_at  timestamptz not null default now()
);

-- ── events (product analytics; written by the app, queried in SQL) ──────────
create table if not exists events (
  id         bigserial primary key,
  user_id    uuid,                              -- null for demo/anonymous
  name       text not null,                     -- e.g. 'paywall_view'
  props      jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists events_name_time_idx on events(name, created_at desc);

-- ── ai_predictions (the track record — ODDIQ's moat) ────────────────────────
-- Every generated analysis logs the model's probability vs the market's at that
-- moment. When the market resolves, we score whether ODDIQ beat the market.
create table if not exists ai_predictions (
  id                  bigserial primary key,
  market_id           text not null references markets(id) on delete cascade,
  title               text not null,
  category            category,
  ai_probability      numeric not null,   -- ODDIQ's estimate, 0..1
  market_probability  numeric not null,   -- market implied at prediction time
  edge_gap            numeric not null,   -- ai - market (signed)
  direction           text not null,      -- 'higher' | 'lower' | 'inline'
  depth               text not null,
  created_at          timestamptz not null default now(),
  -- resolution (filled by resolve-predictions once the market settles)
  resolved            boolean not null default false,
  outcome             numeric,            -- 1 = YES occurred, 0 = NO
  resolved_at         timestamptz,
  ai_correct          boolean,            -- was ODDIQ closer to truth than the market?
  ai_brier            numeric,            -- (ai_probability - outcome)^2  (lower = better)
  market_brier        numeric             -- (market_probability - outcome)^2
);
create index if not exists predictions_unresolved_idx on ai_predictions(resolved) where resolved = false;
create index if not exists predictions_market_idx on ai_predictions(market_id);

-- Rolling accuracy: how often ODDIQ's estimate beat the market's, and the
-- Brier-score edge (positive = ODDIQ more accurate). Public read (it's the pitch).
create or replace view track_record as
select
  count(*)                                             as resolved_predictions,
  round(avg(case when ai_correct then 1 else 0 end) * 100, 1) as beat_market_pct,
  round(avg(market_brier - ai_brier)::numeric, 4)      as brier_edge
from ai_predictions
where resolved = true;

-- ── ai_usage (server-side daily quota — the real enforcement) ───────────────
create table if not exists ai_usage (
  user_id uuid not null references users(id) on delete cascade,
  day     date not null default current_date,
  count   int  not null default 0,
  primary key (user_id, day)
);

-- Atomic per-user daily increment; returns the new count. security definer so
-- the Edge Function (service role) can call it; not exposed to anon.
create or replace function increment_ai_usage(p_user uuid)
returns int language plpgsql security definer as $$
declare c int;
begin
  insert into ai_usage(user_id, day, count) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set count = ai_usage.count + 1
  returning count into c;
  return c;
end $$;

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table users         enable row level security;
alter table watchlists    enable row level security;
alter table alerts        enable row level security;
alter table subscriptions enable row level security;
-- markets / snapshots / ai_analysis are public read (shared catalog).
alter table markets          enable row level security;
alter table market_snapshots enable row level security;
alter table ai_analysis      enable row level security;
alter table ai_usage         enable row level security;
alter table ai_predictions   enable row level security;
-- No client policy on ai_predictions: only the service-role functions read/write
-- rows. The aggregate track_record view is exposed instead.
grant select on track_record to anon, authenticated;

create policy "own profile"        on users         for all    using (auth.uid() = id) with check (auth.uid() = id);
create policy "own watchlist"      on watchlists    for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own alerts"         on alerts        for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own subscription"   on subscriptions for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table events enable row level security;
-- Insert-only from clients (anyone may log; nobody may read/modify from the app).
create policy "events insertable" on events for insert with check (true);

create policy "markets readable"   on markets          for select using (true);
create policy "snapshots readable" on market_snapshots for select using (true);
-- ai_analysis is the PAID product: no client read policy. Only the service-role
-- Edge Function reads/writes it; clients receive analysis through the function,
-- which enforces auth + tier + daily quota. (Previously world-readable — that
-- let anyone pull every paid analysis with the public anon key.)
create policy "own ai usage" on ai_usage for select using (auth.uid() = user_id);

-- MIGRATION for an existing project — remove the old public read on ai_analysis:
--   drop policy if exists "analysis readable" on ai_analysis;
