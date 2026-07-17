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
  summary               text not null,
  bull_case             text not null,
  bear_case             text not null,
  why_changed           text not null,
  catalysts             text[] not null default '{}',
  risk_factors          text[] not null default '{}',
  confidence            confidence not null,
  ai_probability_estimate numeric,               -- 0..1
  created_at            timestamptz not null default now(),
  unique (market_id, snapshot_hash)
);

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

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table users         enable row level security;
alter table watchlists    enable row level security;
alter table alerts        enable row level security;
alter table subscriptions enable row level security;
-- markets / snapshots / ai_analysis are public read (shared catalog).
alter table markets          enable row level security;
alter table market_snapshots enable row level security;
alter table ai_analysis      enable row level security;

create policy "own profile"        on users         for all    using (auth.uid() = id) with check (auth.uid() = id);
create policy "own watchlist"      on watchlists    for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own alerts"         on alerts        for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own subscription"   on subscriptions for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table events enable row level security;
-- Insert-only from clients (anyone may log; nobody may read/modify from the app).
create policy "events insertable" on events for insert with check (true);

create policy "markets readable"   on markets          for select using (true);
create policy "snapshots readable" on market_snapshots for select using (true);
create policy "analysis readable"  on ai_analysis      for select using (true);
