import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';
import { getTrackRecord, type TrackRecord } from '@/services/trackRecord';

// A concrete, real-shaped example shown BEFORE signup so the value lands in
// seconds. Static sample (not a live call) - it's a teaser, not a promise.
const SAMPLE = {
  title: 'Will the Fed cut rates in September?',
  market: 0.43,
  oddiq: 0.5,
  edge: 'The 43% looks low: cooling inflation and a softer labor market lean the Fed toward a cut. Fair value is closer to 50%.',
};

export function ExampleEdge() {
  const [record, setRecord] = useState<TrackRecord | null>(null);
  useEffect(() => {
    void getTrackRecord().then(setRecord);
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="flash" size={13} color={colors.accent} />
        <Text style={styles.kicker}>SAMPLE ODDIQ EDGE</Text>
      </View>
      <Text style={styles.title}>{SAMPLE.title}</Text>
      <View style={styles.compareRow}>
        <View style={styles.compareCell}>
          <Text style={styles.compareVal}>{Math.round(SAMPLE.market * 100)}%</Text>
          <Text style={styles.compareLbl}>market</Text>
        </View>
        <Ionicons name="arrow-forward" size={14} color={colors.textFaint} />
        <View style={styles.compareCell}>
          <Text style={[styles.compareVal, { color: colors.accent }]}>
            {Math.round(SAMPLE.oddiq * 100)}%
          </Text>
          <Text style={styles.compareLbl}>ODDIQ</Text>
        </View>
        <View style={styles.gapPill}>
          <Text style={styles.gapText}>+{Math.round((SAMPLE.oddiq - SAMPLE.market) * 100)} pts</Text>
        </View>
      </View>
      <Text style={styles.edge}>{SAMPLE.edge}</Text>
      {record && (
        <Text style={styles.record}>
          Track record: ODDIQ beat the market on {record.beatMarketPct}% of{' '}
          {record.resolvedPredictions} resolved calls.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // A pull-quote: accent rule down the spine, no card.
  card: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    backgroundColor: colors.accentDim,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { ...typography.ticker, fontSize: 8.5, color: colors.accent },
  title: { ...typography.heading, color: colors.text },
  compareRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.lg },
  compareCell: { alignItems: 'flex-start' },
  compareVal: { ...typography.statLarge, fontSize: 19, color: colors.text },
  compareLbl: { ...typography.ticker, fontSize: 8, color: colors.textFaint, marginTop: 2 },
  gapPill: {
    marginLeft: 'auto',
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  gapText: { ...typography.stat, fontSize: 11, color: colors.accent },
  edge: { ...typography.prose, fontSize: 13, color: colors.textMuted },
  record: { ...typography.ticker, fontSize: 8.5, color: colors.accent },
});
