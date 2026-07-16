import { Text, View, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import type { AISignal } from '@/types';

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

const styles = StyleSheet.create({
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
