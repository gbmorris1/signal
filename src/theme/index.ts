// Signal design tokens — dark, restrained, finance-terminal feel.
// No raw hex outside this file.

export const colors = {
  // surfaces — near-black with a cold cast, layered subtly
  bg: '#0A0B0E',
  surface: '#121419',
  surfaceElevated: '#1A1D24',
  border: '#22252D',
  borderStrong: '#2E323C',
  // text
  text: '#F4F5F7',
  textMuted: '#9BA1AC',
  textFaint: '#5D636E',
  // brand / accent
  accent: '#4E8DFF',
  accentDim: '#16233F',
  // semantics
  up: '#2FD48C',
  upDim: '#0F2A20',
  down: '#FF5A6B',
  downDim: '#331419',
  warn: '#FFB020',
  // signal chips
  signalOpportunity: '#2FD48C',
  signalWatch: '#4E8DFF',
  signalNeutral: '#9BA1AC',
  signalCaution: '#FFB020',
  // platform identities — keep these visually distinct everywhere
  polymarket: '#8B7CFF',
  polymarketDim: '#1E1A38',
  kalshi: '#00C2A8',
  kalshiDim: '#0A2622',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.8 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  /** Small-caps section/label treatment. */
  kicker: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  mono: { fontSize: 15, fontWeight: '600' as const, fontVariant: ['tabular-nums'] as ['tabular-nums'] },
} as const;

export const theme = { colors, spacing, radius, typography } as const;
export type Theme = typeof theme;
