import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View, StyleSheet, useWindowDimensions } from 'react-native';
import { colors, motion, radius, spacing, typography } from '@/theme';

/**
 * The signature object: ODDIQ's estimate against the market's, with the gap
 * between them as the hero. This is the product in one graphic — every rival
 * shows a probability; only this shows the *disagreement*, which is the thing
 * a trader is actually buying.
 *
 * Choreography on arrival: the scale rules in, both markers travel to their
 * prices, then the gap band fills between them and the delta lands.
 */
export function EdgeMeter({
  marketProbability,
  oddiqProbability,
  width,
}: {
  marketProbability: number;
  oddiqProbability: number;
  width?: number;
}) {
  const { width: winW } = useWindowDimensions();
  const trackW = (width ?? winW - spacing.lg * 2) - 4;

  const marketPct = Math.round(marketProbability * 100);
  const oddiqPct = Math.round(oddiqProbability * 100);
  const gap = oddiqPct - marketPct;
  const rich = gap > 0; // ODDIQ thinks YES is underpriced

  const lo = Math.min(marketProbability, oddiqProbability);
  const hi = Math.max(marketProbability, oddiqProbability);

  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.slow,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, marketProbability, oddiqProbability]);

  const bandLeft = lo * trackW;
  const bandWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(2, (hi - lo) * trackW)],
  });
  const oddiqX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [marketProbability * trackW, oddiqProbability * trackW],
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={styles.kicker}>Market vs ODDIQ</Text>
        <View style={[styles.gapPill, { borderColor: rich ? colors.up : colors.down }]}>
          <Text style={[styles.gapText, { color: rich ? colors.up : colors.down }]}>
            {gap > 0 ? '+' : ''}
            {gap} pts
          </Text>
        </View>
      </View>

      <View style={[styles.track, { width: trackW }]}>
        {/* quarter ticks */}
        {[0.25, 0.5, 0.75].map((t) => (
          <View key={t} style={[styles.tick, { left: t * trackW }]} />
        ))}
        {/* the disagreement */}
        <Animated.View style={[styles.band, { left: bandLeft, width: bandWidth }]} />
        {/* market marker: hollow, neutral — what the crowd says */}
        <View style={[styles.marker, styles.marketMarker, { left: marketProbability * trackW - 5 }]} />
        {/* ODDIQ marker: filled ochre — what we say */}
        <Animated.View
          style={[styles.marker, styles.oddiqMarker, { transform: [{ translateX: oddiqX }] }]}
        />
      </View>

      <View style={[styles.labels, { width: trackW }]}>
        <View>
          <Text style={styles.valMarket}>{marketPct}%</Text>
          <Text style={styles.valLabel}>market</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.valOddiq}>{oddiqPct}%</Text>
          <Text style={[styles.valLabel, { textAlign: 'right' }]}>ODDIQ</Text>
        </View>
      </View>
    </View>
  );
}

const MARKER = 10;

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { ...typography.ticker, color: colors.textFaint },
  gapPill: { borderWidth: 1, borderRadius: radius.xs, paddingHorizontal: 6, paddingVertical: 2 },
  gapText: { ...typography.stat, fontSize: 11 },
  track: {
    height: MARKER,
    justifyContent: 'center',
    marginTop: 2,
  },
  tick: { position: 'absolute', width: 1, height: 4, backgroundColor: colors.rule, top: 3 },
  band: {
    position: 'absolute',
    height: 3,
    backgroundColor: colors.accent,
    borderRadius: radius.xs,
  },
  marker: {
    position: 'absolute',
    width: MARKER,
    height: MARKER,
    borderRadius: radius.xs,
  },
  marketMarker: {
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    backgroundColor: colors.bg,
  },
  oddiqMarker: { backgroundColor: colors.accent, marginLeft: -5 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  valMarket: { ...typography.stat, fontSize: 14, color: colors.textMuted },
  valOddiq: { ...typography.stat, fontSize: 14, color: colors.accent },
  valLabel: { ...typography.ticker, fontSize: 8, color: colors.textGhost, marginTop: 1 },
});
