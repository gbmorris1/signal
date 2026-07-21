// Dynamic Expo config. Expo auto-loads `.env` (any EXPO_PUBLIC_* var) before
// evaluating this file, so real keys live in `.env` (git-ignored) — never in
// app.json. Falls back to app.json's placeholders when a var is unset, which
// keeps the app running on mock data with no .env present.
const appJson = require('./app.json');

const env = process.env;
const bool = (v, fallback) => (v === undefined ? fallback : v === 'true');

// EAS build servers do NOT get `.env` — it's git-ignored, so it is never uploaded,
// and EAS does not read local env files. Without EAS environment variables set,
// every EXPO_PUBLIC_* below falls back to app.json's PLACEHOLDER values, which
// silently flips the app to `useMockData: true` with an unusable Supabase URL.
//
// That failure is invisible locally (`expo start` reads .env fine) and produces a
// TestFlight build serving FABRICATED markets as live prices — the exact thing
// PolymarketSource was hardened against. So fail the build loudly instead.
//
// Fix when this fires (values never belong in this repo — it's public):
//   eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value <url>
//   eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <key>
//   eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value <key>
// (repeat with --environment preview/development for those profiles)
function assertBuildConfig(env) {
  if (!env.EAS_BUILD) return; // local dev: mock data is a legitimate mode
  const missing = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'].filter(
    (k) => !env[k],
  );
  if (missing.length > 0) {
    throw new Error(
      `EAS build is missing ${missing.join(', ')}. The build would ship on MOCK DATA ` +
        `with a placeholder backend. Set them as EAS environment variables — see app.config.js.`,
    );
  }
}

module.exports = () => {
  assertBuildConfig(process.env);
  return {
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
  };
};
