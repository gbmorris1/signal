import { Text, View, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import type { AISignal, Platform } from '@/types';

const SIGNAL_COLOR: Record<AISignal, string> = {
  opportunity: colors.signalOpportunity,
  watch: colors.signalWatch,
  neutral: colors.signalNeutral,
  caution: colors.signalCaution,
};

const SIGNAL_LABEL: Record<AISignal, string> = {
  opportunity: 'Opportunity',
  watch: 'Watch',
  neutral: 'Neutral',
  caution: 'Caution',
};

export function SignalChip({ signal }: { signal: AISignal }) {
  const c = SIGNAL_COLOR[signal];
  return (
    <View style={[styles.chip, { borderColor: c }]}>
      <View style={[styles.dot, { backgroundColor: c }]} />
      <Text style={[styles.label, { color: c }]}>{SIGNAL_LABEL[signal]}</Text>
    </View>
  );
}

const PLATFORM_STYLE: Record<Platform, { color: string; bg: string; label: string }> = {
  polymarket: { color: colors.polymarket, bg: colors.polymarketDim, label: 'POLYMARKET' },
  kalshi: { color: colors.kalshi, bg: colors.kalshiDim, label: 'KALSHI' },
};

/** Brand-colored platform badge — platform identity should be unmissable. */
export function PlatformBadge({ platform, size = 'sm' }: { platform: Platform; size?: 'sm' | 'md' }) {
  const s = PLATFORM_STYLE[platform];
  return (
    <View style={[styles.platform, { backgroundColor: s.bg }, size === 'md' && styles.platformMd]}>
      <Text
        style={[styles.platformText, { color: s.color }, size === 'md' && styles.platformTextMd]}
      >
        {s.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  platform: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  platformMd: { paddingHorizontal: 8, paddingVertical: 3 },
  platformText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  platformTextMd: { fontSize: 11 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    gap: 6,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 12, fontWeight: '600' },
});
