import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, shadows } from '@/theme';
import { getTrackRecord, TRACK_RECORD_PROVEN_MIN, type TrackRecord } from '@/services/trackRecord';

/**
 * The moat, made visible. Most competitors claim accuracy; ODDIQ shows a
 * verified, resolved-outcome ledger. This card is deliberately central on Home:
 *  - proven (≥ TRACK_RECORD_PROVEN_MIN resolved): headline "beat the market" stat,
 *  - building (some or no resolves): sells the mechanism honestly, which is itself
 *    a trust signal ("we log and score every call") rather than hiding it.
 */
export function TrackRecordCard() {
  const [record, setRecord] = useState<TrackRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // minSample 1 → get data as soon as anything has resolved; the card decides
    // whether that's enough to headline.
    void getTrackRecord(1).then((r) => {
      setRecord(r);
      setLoaded(true);
    });
  }, []);

  const proven = record && record.resolvedPredictions >= TRACK_RECORD_PROVEN_MIN;

  return (
    <View style={[styles.card, proven ? shadows.glowUp : null]}>
      <View style={styles.head}>
        <Ionicons name="ribbon-outline" size={13} color={proven ? colors.up : colors.accent} />
        <Text style={[styles.kicker, { color: proven ? colors.up : colors.accent }]}>
          TRACK RECORD
        </Text>
        <View style={{ flex: 1 }} />
        <View style={styles.verifiedPill}>
          <Ionicons name="shield-checkmark" size={10} color={colors.textMuted} />
          <Text style={styles.verifiedText}>VERIFIED</Text>
        </View>
      </View>

      {proven ? (
        <>
          <View style={styles.statRow}>
            <Text style={styles.bigStat}>{Math.round(record!.beatMarketPct)}%</Text>
            <Text style={styles.bigStatUnit}>beat the market</Text>
          </View>
          <Text style={styles.sub}>
            Across {record!.resolvedPredictions} resolved calls, ODDIQ's probability was closer to
            the outcome than the market's{record!.brierEdge > 0 ? ', and better calibrated overall' : ''}.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.title}>Every call, scored.</Text>
          <Text style={styles.sub}>
            ODDIQ logs its probability against the market on every analysis and scores it the moment
            the market resolves. The verified record appears here as calls settle, with no cherry-picking.
          </Text>
          {loaded && record && record.resolvedPredictions > 0 && (
            <Text style={styles.building}>
              {record.resolvedPredictions} scored so far, building toward a statistically meaningful
              sample.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { ...typography.kicker, fontSize: 10 },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  verifiedText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6, color: colors.textMuted },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: 2 },
  bigStat: { ...typography.monoDisplay, color: colors.up, fontSize: 36 },
  bigStatUnit: { ...typography.body, color: colors.textMuted, fontWeight: '700' },
  title: { ...typography.title, color: colors.text, fontSize: 19, marginTop: 2 },
  sub: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  building: { fontSize: 12, color: colors.accent, fontWeight: '700', marginTop: 2 },
});
