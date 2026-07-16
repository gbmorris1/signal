# Signal

**The AI research terminal for prediction markets.** A mobile-first (iOS) daily-intelligence app for discovering, understanding, and monitoring prediction markets across Polymarket and Kalshi.

Built with **React Native · Expo · TypeScript**, backed by **Supabase (PostgreSQL + Auth)**, AI analysis via the **Anthropic Claude API**, subscriptions via **RevenueCat**, and push via **Expo Notifications**.

> Status: MVP in progress (built iteratively). The app runs **fully on mock data with zero keys** so you can launch and click through every screen immediately.

## Quick start

```bash
cd signal
npm install
npm run start      # then press `i` for the iOS simulator, or scan the QR in Expo Go
```

No keys are required for the mock experience (`useMockData: true` in `app.json`).

## Scripts

| Command | What it does |
|---|---|
| `npm run start` | Start Expo dev server |
| `npm run ios` | Open in the iOS simulator |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Jest unit tests |
| `npm run build:check` | `expo export` build verification |

## Architecture

See [`docs/TECHNICAL_PLAN.md`](docs/TECHNICAL_PLAN.md). Highlights:

- **`src/services/markets`** — `MarketDataSource` interface. `MockSource` today; `PolymarketSource` (and later Kalshi) drop in behind the same interface.
- **`src/services/ai`** — analysis pipeline. Calls the `analyze-market` Supabase Edge Function (which holds the Anthropic key) and validates the structured JSON with Zod. Falls back to canned analysis when no backend is configured. Results are cached by input hash.
- **`src/theme`** — all design tokens (dark, premium). No raw hex elsewhere.
- **`app/`** — expo-router tree: `(tabs)` = Home · Discover · Watchlist · Alerts · Profile; `market/[id]` = intelligence page.
- **`supabase/schema.sql`** — full PostgreSQL schema with RLS.

## Screens

- **Home** — Morning Briefing + market cards ("N markets deserve attention today").
- **Discover** — Trending / Biggest Movers / AI Opportunities, category filters, search.
- **Market detail** — odds, probability history sparkline, and AI analysis (summary, bull/bear, why it moved, catalysts, risks, confidence) behind an "Explain this move" button.
- **Watchlist** — saved markets (persisted locally, syncs to Supabase once auth is wired).
- **Alerts** — basic moves and premium AI-shift notifications.
- **Profile** — account + subscription tiers (Free / Pro $19.99 / Trader $99).

## Connecting real services

1. **Supabase** — create a project, run `supabase/schema.sql`, set `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and flip `useMockData` to `false` in `app.json`.
2. **Live Polymarket data** — set `useLiveData: true` (and `useMockData: false`) in `app.json`. `PolymarketSource` reads the public Gamma API and falls back to mock data on any error.
3. **Anthropic** — deploy the analysis Edge Function and set its secret:
   ```bash
   supabase functions deploy analyze-market
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
   The key lives only in the function (`supabase/functions/analyze-market`), never in the app bundle. Results are cached in `ai_analysis` by input hash.
4. **RevenueCat** — configure entitlements `signal_pro` / `signal_trader`, set `EXPO_PUBLIC_REVENUECAT_IOS_KEY`.
5. **Push** — Expo push tokens registered on sign-in; alerts delivered via a scheduled job.

See `.env.example`.
