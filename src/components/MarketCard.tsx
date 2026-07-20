import { memo } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, categoryColors, radius, spacing, typography } from '@/theme';
import { signedPct } from '@/lib/format';
import type { AISignal, Market } from '@/types';

const SIGNAL_LABEL: Record<AISignal, string> = {
  opportunity: 'Opportunity',
  watch: 'Watch',
  neutral: 'Neutral',
  caution: 'Caution',
};
const SIGNAL_COLOR: Record<AISignal, string> = {
  opportunity: colors.accent,
  watch: colors.textMuted,
  neutral: colors.textFaint,
  caution: colors.warn,
};

/**
 * A market as a ruled terminal row: mono metadata up top, the question in
 * serif (it's the thing you read), a probability bar, and mono numerals for
 * everything you compare. Rules, not floating cards.
 */
function MarketCardInner({ market, reason }: { market: Market; reason?: string }) {
  const up = market.change24h >= 0;
  const flat = Math.round(market.change24h * 100) === 0;
  const pctValue = Math.round(market.probability * 100);
  const [labelA] = market.outcomeLabels;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => router.push(`/market/${encodeURIComponent(market.id)}`)}
      accessibilityRole="button"
      accessibilityLabel={`${market.title}, ${labelA} at ${pctValue} percent`}
    >
      <View style={styles.meta}>
        <View style={styles.metaLeft}>
          <View
            style={[
              styles.catDot,
              { backgroundColor: categoryColors[market.category] ?? colors.textFaint },
            ]}
          />
          <Text style={styles.metaText} numberOfLines={1}>
            {market.platform} · {market.category}
          </Text>
        </View>
        <Text style={[styles.signal, { color: SIGNAL_COLOR[market.signal] }]}>
          {SIGNAL_LABEL[market.signal]}
        </Text>
      </View>

      <Text style={styles.question} numberOfLines={2}>
        {market.title}
      </Text>

      {reason && (
        <Text style={styles.reason} numberOfLines={1}>
          {reason}
        </Text>
      )}

      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${Math.max(2, Math.min(100, pctValue))}%` }]} />
      </View>

      <View style={styles.nums}>
        <Text style={styles.outcome} numberOfLines={1}>
          <Text style={styles.outcomeLabel}>{labelA} </Text>
          {pctValue}%
        </Text>
        {!flat && (
          <Text style={[styles.delta, { color: up ? colors.up : colors.down }]}>
            {signedPct(market.change24h)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export const MarketCard = memo(
  MarketCardInner,
  (a, b) =>
    a.market.id === b.market.id &&
    a.market.probability === b.market.probability &&
    a.market.change24h === b.market.change24h &&
    a.reason === b.reason,
);

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  pressed: { backgroundColor: colors.surface },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  catDot: { width: 5, height: 5, borderRadius: 1 },
  metaText: { ...typography.ticker, color: colors.textFaint, flexShrink: 1 },
  signal: { ...typography.ticker },
  question: { ...typography.heading, color: colors.text },
  reason: { ...typography.caption, color: colors.accent, fontSize: 11.5 },
  bar: { height: 3, backgroundColor: colors.surfaceHigh, borderRadius: radius.xs, overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: colors.accent, borderRadius: radius.xs },
  nums: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  outcome: { ...typography.stat, color: colors.text, flex: 1 },
  outcomeLabel: { color: colors.textMuted },
  delta: { ...typography.statSmall, fontSize: 12 },
});
