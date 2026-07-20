import { Text, View, StyleSheet } from 'react-native';
import { colors, radius, typography } from '@/theme';
import type { AISignal, Platform } from '@/types';

const SIGNAL_COLOR: Record<AISignal, string> = {
  opportunity: colors.accent,
  watch: colors.textMuted,
  neutral: colors.textFaint,
  caution: colors.warn,
};

const SIGNAL_LABEL: Record<AISignal, string> = {
  opportunity: 'Opportunity',
  watch: 'Watch',
  neutral: 'Neutral',
  caution: 'Caution',
};

/** Signal state as a squared terminal tag rather than a rounded pill. */
export function SignalChip({ signal }: { signal: AISignal }) {
  const c = SIGNAL_COLOR[signal];
  return (
    <View style={[styles.tag, { borderColor: c }]}>
      <Text style={[styles.tagText, { color: c }]}>{SIGNAL_LABEL[signal]}</Text>
    </View>
  );
}

const PLATFORM_STYLE: Record<Platform, { color: string; label: string }> = {
  polymarket: { color: colors.polymarket, label: 'Polymarket' },
  kalshi: { color: colors.kalshi, label: 'Kalshi' },
};

/** Venue identity: a colour-keyed rule + name. Ownership must be unmissable. */
export function PlatformBadge({ platform, size = 'sm' }: { platform: Platform; size?: 'sm' | 'md' }) {
  const s = PLATFORM_STYLE[platform];
  return (
    <View style={styles.platform}>
      <View style={[styles.venueRule, { backgroundColor: s.color }]} />
      <Text
        style={[styles.platformText, { color: s.color }, size === 'md' && styles.platformTextMd]}
      >
        {s.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  platform: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  venueRule: { width: 2, height: 10, borderRadius: radius.xs },
  platformText: { ...typography.ticker, fontSize: 9 },
  platformTextMd: { fontSize: 10.5 },
  tag: {
    borderWidth: 1,
    borderRadius: radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  tagText: { ...typography.ticker, fontSize: 8.5 },
});
