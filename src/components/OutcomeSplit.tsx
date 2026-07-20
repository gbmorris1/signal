import { Text, View, StyleSheet } from 'react-native';
import { colors, radius, typography } from '@/theme';
import type { Market } from '@/types';

/**
 * Two-sided outcome bar: both sides of the question, priced. "Yes 43% / No 57%"
 * or "Norris 43% / Verstappen 57%". `market.probability` is always side A.
 */
export function OutcomeSplit({ market, size = 'sm' }: { market: Market; size?: 'sm' | 'lg' }) {
  const pA = market.probability;
  const pB = 1 - pA;
  const [labelA, labelB] = market.outcomeLabels;
  const lg = size === 'lg';

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, lg && styles.barLg]}>
        <View style={[styles.segA, { flex: Math.max(0.06, pA) }]} />
        <View style={styles.gap} />
        <View style={[styles.segB, { flex: Math.max(0.06, pB) }]} />
      </View>
      <View style={styles.labels}>
        <Text style={[styles.labelA, lg && styles.labelLg]} numberOfLines={1}>
          {labelA} <Text style={styles.pct}>{Math.round(pA * 100)}%</Text>
        </Text>
        <Text style={[styles.labelB, lg && styles.labelLg]} numberOfLines={1}>
          <Text style={styles.pct}>{Math.round(pB * 100)}%</Text> {labelB}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  // Squared bar: side A carries the accent, side B is neutral ground, so the
  // eye reads position rather than a red/green value judgement.
  bar: { flexDirection: 'row', height: 4, overflow: 'hidden' },
  barLg: { height: 6 },
  segA: { backgroundColor: colors.accent, borderRadius: radius.xs },
  segB: { backgroundColor: colors.surfaceHigh, borderRadius: radius.xs },
  gap: { width: 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  labelA: { ...typography.prose, fontSize: 12.5, color: colors.text, flexShrink: 1 },
  labelB: { ...typography.prose, fontSize: 12.5, color: colors.textMuted, flexShrink: 1, textAlign: 'right' },
  labelLg: { fontSize: 14 },
  pct: { ...typography.stat, fontSize: 12.5 },
});
