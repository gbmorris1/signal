import { Text, View, StyleSheet } from 'react-native';
import { colors, radius } from '@/theme';
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
  wrap: { gap: 5 },
  bar: { flexDirection: 'row', height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  barLg: { height: 8 },
  segA: { backgroundColor: colors.up, borderRadius: radius.pill },
  segB: { backgroundColor: colors.down, borderRadius: radius.pill },
  gap: { width: 3 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  labelA: { fontSize: 12, fontWeight: '600', color: colors.up, flexShrink: 1 },
  labelB: { fontSize: 12, fontWeight: '600', color: colors.down, flexShrink: 1, textAlign: 'right' },
  labelLg: { fontSize: 14 },
  pct: { fontVariant: ['tabular-nums'] },
});
