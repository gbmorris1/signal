// ODDIQ design system — "Research Terminal".
//
// The direction: a research publication wearing a terminal's structure. Warm
// ink ground, ochre accent, hairline rules instead of floating cards, and a
// THREE-ROLE type system that deliberately breaks the usual "one family" rule:
//
//   serif (Libre Bodoni)   → reading: market questions, the AI thesis
//   mono  (JetBrains Mono) → data:    every number, label, timestamp, rank
//   sans  (Public Sans)    → chrome:  controls, captions, secondary UI
//
// That split is how editorial-data products (FT, Bloomberg, The Economist's
// data desk) read authoritative rather than generic.
//
// Tokens are layered: PRIMITIVE (raw values) → SEMANTIC (meaning) → COMPONENT
// (recipes). Screens should consume SEMANTIC/COMPONENT tokens, never primitives.
import type { TextStyle, ViewStyle } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — PRIMITIVES. Raw values. Never referenced directly by screens.
// ─────────────────────────────────────────────────────────────────────────────
const palette = {
  // Warm ink ground. The warmth is what separates this from cold fintech dark.
  ink900: '#0B0A0D',
  ink800: '#0E0D10',
  ink700: '#141216',
  ink600: '#1A171C',
  ink500: '#221E24',

  paper: '#F3EFE8', // warm off-white, the "printed" text colour
  ochre: '#C9A227', // the accent: brass/ochre, not cyan
  ochreBright: '#E3BC42',

  sage: '#6FBF8B', // up / positive — muted, editorial, not neon
  rust: '#D9614C', // down / negative
  amber: '#D9A441', // caution

  violet: '#8B7CFF', // Polymarket brand
  teal: '#00C2A8', // Kalshi brand
} as const;

const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — SEMANTIC. What things MEAN. This is what screens consume.
// ─────────────────────────────────────────────────────────────────────────────
export const colors = {
  // grounds
  bg: palette.ink800,
  bgDeep: palette.ink900,
  surface: palette.ink700,
  surfaceElevated: palette.ink600,
  surfaceHigh: palette.ink500,

  // text, by role (opacity carries hierarchy)
  text: palette.paper,
  textMuted: alpha(palette.paper, 0.66),
  textFaint: alpha(palette.paper, 0.42),
  textGhost: alpha(palette.paper, 0.26),

  // hairline rules do the structural work that shadows used to
  rule: alpha(palette.paper, 0.13),
  ruleStrong: alpha(palette.paper, 0.22),
  border: alpha(palette.paper, 0.13),
  borderStrong: alpha(palette.paper, 0.22),

  // accent
  accent: palette.ochre,
  accentBright: palette.ochreBright,
  accentDim: alpha(palette.ochre, 0.12),
  accentEdge: alpha(palette.ochre, 0.34),

  // market direction
  up: palette.sage,
  upDim: alpha(palette.sage, 0.13),
  down: palette.rust,
  downDim: alpha(palette.rust, 0.13),
  warn: palette.amber,
  warnDim: alpha(palette.amber, 0.13),

  // signal chips
  signalOpportunity: palette.ochre,
  signalWatch: palette.paper,
  signalNeutral: alpha(palette.paper, 0.5),
  signalCaution: palette.amber,

  // platform identity (kept vivid — venue ownership must be unmissable)
  polymarket: palette.violet,
  polymarketDim: alpha(palette.violet, 0.14),
  kalshi: palette.teal,
  kalshiDim: alpha(palette.teal, 0.14),

  // brand mark
  brandNavy: '#1E2A5C',
  brandBlue: '#1E6FD9',
} as const;

/** Per-category hues — small dots/tints only, never text. */
export const categoryColors: Record<string, string> = {
  politics: '#D9614C',
  finance: '#C9A227',
  crypto: '#E0A03C',
  sports: '#6FBF8B',
  world: '#9B8CFF',
  technology: '#4FB3C4',
};

// 8-pt grid (4 as half-step)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Terminal geometry: near-square. Roundness reads consumer; this reads instrument. */
export const radius = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  pill: 999,
} as const;

// ── Type ────────────────────────────────────────────────────────────────────
export const fonts = {
  serifRegular: 'LibreBodoni_400Regular',
  serif: 'LibreBodoni_600SemiBold',
  monoRegular: 'JetBrainsMono_400Regular',
  mono: 'JetBrainsMono_700Bold',
  sansRegular: 'PublicSans_400Regular',
  sans: 'PublicSans_600SemiBold',
  sansBold: 'PublicSans_700Bold',
} as const;

const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * Type roles. Pick by JOB, not by size:
 *   display / title / heading / prose → serif (things you read)
 *   stat / statHero / ticker          → mono  (things you compare)
 *   body / caption / button / kicker  → sans  (things you operate)
 */
export const typography = {
  // ── serif: reading
  display: { fontFamily: fonts.serif, fontSize: 30, letterSpacing: -0.4, lineHeight: 34 },
  title: { fontFamily: fonts.serif, fontSize: 21, letterSpacing: -0.2, lineHeight: 26 },
  heading: { fontFamily: fonts.serif, fontSize: 16, letterSpacing: -0.1, lineHeight: 21 },
  /** Long-form analysis copy — the thesis. Serif at reading size. */
  prose: { fontFamily: fonts.serifRegular, fontSize: 14.5, lineHeight: 23 },

  // ── mono: data
  statHero: { fontFamily: fonts.mono, fontSize: 34, letterSpacing: -1.4, ...TABULAR },
  statLarge: { fontFamily: fonts.mono, fontSize: 22, letterSpacing: -0.6, ...TABULAR },
  stat: { fontFamily: fonts.mono, fontSize: 14, ...TABULAR },
  statSmall: { fontFamily: fonts.monoRegular, fontSize: 11, ...TABULAR },
  /** Uppercase micro-label: the terminal's voice. */
  ticker: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase' as const },

  // ── sans: chrome
  body: { fontFamily: fonts.sansRegular, fontSize: 14, lineHeight: 20 },
  bodyStrong: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.sansRegular, fontSize: 12, lineHeight: 17 },
  button: { fontFamily: fonts.sansBold, fontSize: 14, letterSpacing: 0.2 },
  kicker: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' as const },
} as const;

// ── Motion ──────────────────────────────────────────────────────────────────
export const motion = {
  instant: 120,
  fast: 200,
  base: 280,
  slow: 420,
  chart: 900,
  /** Standard ease-out; use for anything entering. */
  easeOut: [0.22, 0.61, 0.36, 1] as const,
  stagger: 45,
} as const;

// ── Elevation ───────────────────────────────────────────────────────────────
// Shadows are near-absent by design; structure comes from rules. Reserved for
// genuinely floating surfaces (sheets, modals).
export const shadows: Record<'none' | 'sheet' | 'raised' | 'accentEdge', ViewStyle> = {
  none: {},
  sheet: {
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  raised: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  accentEdge: {
    shadowColor: palette.ochre,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3 — COMPONENT RECIPES.
// ─────────────────────────────────────────────────────────────────────────────

/** Default surface: a ruled panel, not a floating card. */
export const card: ViewStyle = {
  backgroundColor: colors.surface,
  borderColor: colors.rule,
  borderWidth: 1,
  borderRadius: radius.md,
  padding: spacing.lg,
};

/** A row in a ruled list — the terminal's primary structure. */
export const listRow: ViewStyle = {
  paddingVertical: spacing.md,
  paddingHorizontal: spacing.lg,
  borderBottomColor: colors.rule,
  borderBottomWidth: 1,
};

/** Left edge-stripe marking priority/state (alerts, the edge block). */
export const edgeStripe = (color: string): ViewStyle => ({
  borderLeftWidth: 2,
  borderLeftColor: color,
});

export const buttonPrimary: ViewStyle = {
  backgroundColor: colors.accent,
  borderRadius: radius.sm,
  height: 48,
  alignItems: 'center',
  justifyContent: 'center',
};

export const buttonGhost: ViewStyle = {
  borderRadius: radius.sm,
  height: 48,
  borderWidth: 1,
  borderColor: colors.ruleStrong,
  alignItems: 'center',
  justifyContent: 'center',
};

export const theme = {
  colors,
  spacing,
  radius,
  typography,
  fonts,
  motion,
  shadows,
  card,
  listRow,
} as const;
export type Theme = typeof theme;
