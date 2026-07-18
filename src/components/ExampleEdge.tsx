import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, shadows } from '@/theme';
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
    <View style={[styles.card, shadows.glowAccent]}>
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
  card: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { ...typography.kicker, color: colors.accent, fontSize: 10 },
  title: { ...typography.heading, color: colors.text },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  compareCell: { alignItems: 'center' },
  compareVal: { ...typography.monoLarge, color: colors.text, fontSize: 18 },
  compareLbl: { fontSize: 10, color: colors.textFaint },
  gapPill: {
    marginLeft: 'auto',
    backgroundColor: colors.upDim,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  gapText: { color: colors.up, fontSize: 12, fontWeight: '700' },
  edge: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  record: { fontSize: 11, color: colors.up, fontWeight: '700', marginTop: 2 },
});
