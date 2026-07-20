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
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.kicker}>The verified record</Text>
        <View style={{ flex: 1 }} />
        <Ionicons name="shield-checkmark-outline" size={11} color={colors.textFaint} />
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
  // No card chrome: rules above and below, like a masthead panel.
  card: {
    borderTopColor: colors.rule,
    borderTopWidth: 1,
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { ...typography.ticker, color: colors.accent },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  bigStat: { ...typography.statHero, color: colors.text },
  bigStatUnit: { ...typography.caption, color: colors.textMuted, flex: 1 },
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.prose, color: colors.textMuted, fontSize: 13.5, lineHeight: 21 },
  building: { ...typography.statSmall, color: colors.accent, marginTop: 2 },
});
