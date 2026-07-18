// ODDIQ design tokens — dark finance-terminal system.
// Built on the mobile-app-ui-design rules: one font family, 4 type sizes,
// 2 weights, opacity-driven text hierarchy, 60/30/10 color, 8-pt grid,
// soft tinted shadows. No raw hex outside this file.
import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  // 60% — neutral base (navy-cast near-black, tuned to the ODDIQ mark)
  bg: '#080B14',
  surface: '#111726',
  surfaceElevated: '#182034',
  // Deep navy from the wordmark; brand surfaces + icon field.
  brandNavy: '#0E1E45',
  // hairlines from white opacity so they sit naturally on any surface
  border: 'rgba(244,246,250,0.08)',
  borderStrong: 'rgba(244,246,250,0.15)',
  // 30% — text, hierarchy by opacity (100 / 64 / 40)
  text: '#F5F6F8',
  textMuted: 'rgba(245,246,248,0.64)',
  textFaint: 'rgba(245,246,248,0.40)',
  // 10% — accent: ODDIQ cyan (the ascending arrow) + supporting brand blue
  accent: '#22C9F5',
  accentDim: 'rgba(34,201,245,0.14)',
  // Mid-blue facet from the mark; secondary brand tone.
  brandBlue: '#1E6FD9',
  up: '#2FD48C',
  upDim: 'rgba(47,212,140,0.14)',
  down: '#FF5A6B',
  downDim: 'rgba(255,90,107,0.14)',
  warn: '#FFB020',
  warnDim: 'rgba(255,176,32,0.14)',
  // signal chips
  signalOpportunity: '#2FD48C',
  signalWatch: '#22C9F5',
  signalNeutral: 'rgba(245,246,248,0.64)',
  signalCaution: '#FFB020',
  // platform identities — deliberate exception to the accent budget: platform
  // ownership must be unmissable (user-tested requirement)
  polymarket: '#8B7CFF',
  polymarketDim: 'rgba(139,124,255,0.14)',
  kalshi: '#00C2A8',
  kalshiDim: 'rgba(0,194,168,0.14)',
} as const;

/**
 * Per-category hues. Used ONLY as small dots/tints, never as text color —
 * strong color is reserved for money movement and CTAs.
 */
export const categoryColors: Record<string, string> = {
  politics: '#FF7A59',
  finance: '#3B9BFF',
  crypto: '#F7B32B',
  sports: '#2FD48C',
  world: '#9B8CFF',
  technology: '#00C2D1',
};

// 8-pt grid (4 allowed as half-step)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

// ── Typography: ONE family (system), 4 sizes (34/20/15/12), 2 weights (700/400).
// Hierarchy comes from size + weight + text opacity, not extra variants.
const W_BOLD = '700' as const;
const W_REG = '400' as const;
const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

export const typography = {
  display: { fontSize: 34, fontWeight: W_BOLD, letterSpacing: -0.8 },
  title: { fontSize: 20, fontWeight: W_BOLD, letterSpacing: -0.4 },
  heading: { fontSize: 15, fontWeight: W_BOLD, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: W_REG },
  bodyStrong: { fontSize: 15, fontWeight: W_BOLD },
  caption: { fontSize: 12, fontWeight: W_REG },
  /** Small-caps label. Same 12px step, bold + tracking does the work. */
  kicker: {
    fontSize: 12,
    fontWeight: W_BOLD,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  /** Numbers: same scale, tabular digits. */
  mono: { fontSize: 15, fontWeight: W_BOLD, ...TABULAR },
  monoLarge: { fontSize: 20, fontWeight: W_BOLD, letterSpacing: -0.4, ...TABULAR },
  monoDisplay: { fontSize: 34, fontWeight: W_BOLD, letterSpacing: -0.8, ...TABULAR },
} as const;

// ── Soft shadows, tinted to the near-black bg (never harsh gray).
export const shadows: Record<'card' | 'raised' | 'glowAccent' | 'glowUp' | 'glowDown', ViewStyle> = {
  card: {
    shadowColor: '#05060A',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  raised: {
    shadowColor: '#05060A',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  glowAccent: {
    shadowColor: '#22C9F5',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  glowUp: {
    shadowColor: '#2FD48C',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  glowDown: {
    shadowColor: '#FF5A6B',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
};

/** Primary CTA: accent fill, subtle top highlight (light-source cue), soft shadow. */
export const buttonPrimary: ViewStyle = {
  backgroundColor: colors.accent,
  borderRadius: radius.md,
  height: 50,
  alignItems: 'center',
  justifyContent: 'center',
  ...({
    shadowColor: '#22C9F5',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  } as ViewStyle),
};

/** Shared card recipe: surface + hairline + soft shadow + grid padding. */
export const card: ViewStyle = {
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderWidth: 1,
  borderRadius: radius.lg,
  padding: spacing.xl - 4, // 20 — mobile card baseline on the 4-pt half-step
  ...shadows.card,
};

export const theme = { colors, spacing, radius, typography, shadows, card } as const;
export type Theme = typeof theme;
