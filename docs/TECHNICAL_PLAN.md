# Signal — Technical Plan

**Signal** — "The AI research terminal for prediction markets." A mobile-first (iOS) daily-intelligence app built with React Native + Expo + TypeScript.

## Architecture overview

```
┌─────────────────────────────────────────────────────────┐
│  Expo / React Native app (TypeScript)                    │
│                                                          │
│  Navigation (bottom tabs): Home · Discover · Watchlist   │
│                            · Alerts · Profile            │
│                                                          │
│  Screens ── Components ── Theme (dark, premium tokens)   │
│     │                                                    │
│     ├── services/  (data access, typed)                 │
│     │     ├── markets   (Polymarket adapter → Market)   │
│     │     ├── ai        (Claude analysis pipeline)      │
│     │     ├── auth      (Supabase Auth)                 │
│     │     ├── watchlist                                  │
│     │     ├── alerts    (Expo push)                     │
│     │     └── subscriptions (RevenueCat)                │
│     │                                                    │
│     └── state/ (React Query + light context)            │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Supabase (PostgreSQL + Auth + Edge Functions)          │
│  Tables: users, markets, market_snapshots, ai_analysis, │
│          watchlists, alerts, subscriptions               │
│  Edge fn: analyze-market (calls Anthropic Claude API)   │
└─────────────────────────────────────────────────────────┘
```

## Key design decisions

1. **Data source is an interface.** `MarketDataSource` is a TS interface. `PolymarketSource` implements it now; `KalshiSource` can be added later without touching screens. A `MockSource` backs local/dev runs with no keys.
2. **AI analysis is cached.** `ai_analysis` rows are keyed by `(market_id, snapshot_hash)`. We only call Claude when the market has moved beyond a threshold since the last cached analysis. The pipeline returns structured JSON validated by a Zod schema.
3. **Secrets never ship in the client.** The Anthropic call happens in a Supabase Edge Function. The app calls the function; the function holds `ANTHROPIC_API_KEY`. In dev with no backend, the app uses `MockSource` + canned analyses so it still builds and runs.
4. **Subscriptions gate features, not data.** A `useEntitlements()` hook exposes `free | pro | trader`. UI reads entitlement to gate AI depth, alerts, and watchlist size. RevenueCat is the source of truth; a mock provider backs dev.
5. **Theme first.** All color/spacing/typography live in `src/theme`. No inline hex. Dark, high-contrast, restrained — finance-terminal feel.

## Milestones (Ralph iterations)

- **M1 Scaffold** — Expo app config, TS, theme tokens, navigation skeleton, DB schema SQL, core types, MockSource. Runs in dev.
- **M2 Screens** — Home (Morning Briefing + market cards), Discover (trending/movers/AI-ops/search), Market Detail (charts + AI analysis), Watchlist, Alerts, Profile.
- **M3 Data + AI** — Polymarket adapter, snapshot/movement logic, Claude analysis Edge Function + Zod-validated output, caching.
- **M4 Accounts + Monetization** — Supabase Auth flows, onboarding/interests, RevenueCat entitlements, paywall.
- **M5 Alerts** — Expo push registration, alert rules, notification rendering.
- **M6 Quality** — typecheck, tests (services + reducers), `expo export` build verification, docs. → COMPLETE.

## Completion definition
Typechecks clean, unit tests pass, `expo export` succeeds, and the nine MVP user actions are wired end-to-end against MockSource (real keys optional). Then output `<promise>COMPLETE</promise>`.
