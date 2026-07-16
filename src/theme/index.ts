// Signal design tokens — dark, restrained, finance-terminal feel.
// No raw hex outside this file.

export const colors = {
  // surfaces
  bg: '#0A0B0D',
  surface: '#121418',
  surfaceElevated: '#181B20',
  border: '#23262D',
  // text
  text: '#F2F4F7',
  textMuted: '#9AA3AF',
  textFaint: '#5B626D',
  // brand / accent
  accent: '#4F8CFF',
  accentDim: '#1E2B45',
  // semantics
  up: '#3DDC97',
  down: '#FF5C6C',
  warn: '#FFB020',
  // signal chips
  signalOpportunity: '#3DDC97',
  signalWatch: '#4F8CFF',
  signalNeutral: '#9AA3AF',
  signalCaution: '#FFB020',
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
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  // weights kept system-native for premium feel; sizes scale for hierarchy
  display: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  mono: { fontSize: 15, fontWeight: '600' as const, fontVariant: ['tabular-nums'] as ['tabular-nums'] },
} as const;

export const theme = { colors, spacing, radius, typography } as const;
export type Theme = typeof theme;
