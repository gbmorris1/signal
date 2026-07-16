// Dynamic Expo config. Expo auto-loads `.env` (any EXPO_PUBLIC_* var) before
// evaluating this file, so real keys live in `.env` (git-ignored) — never in
// app.json. Falls back to app.json's placeholders when a var is unset, which
// keeps the app running on mock data with no .env present.
const appJson = require('./app.json');

const env = process.env;
const bool = (v, fallback) => (v === undefined ? fallback : v === 'true');

module.exports = () => ({
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL ?? appJson.expo.extra.supabaseUrl,
    supabaseAnonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? appJson.expo.extra.supabaseAnonKey,
    revenueCatIosKey: env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? appJson.expo.extra.revenueCatIosKey,
    // Flags: default to live data whenever a Supabase URL is provided.
    useMockData: bool(env.EXPO_PUBLIC_USE_MOCK_DATA, !env.EXPO_PUBLIC_SUPABASE_URL),
    useLiveData: bool(env.EXPO_PUBLIC_USE_LIVE_DATA, !!env.EXPO_PUBLIC_SUPABASE_URL),
  },
});
