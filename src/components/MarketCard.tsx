import { useRef } from 'react';
import { Animated, Pressable, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, categoryColors, radius, spacing, typography, card } from '@/theme';
import { pct, signedPct, compactUsd } from '@/lib/format';
import { SignalChip, PlatformBadge } from './Chip';
import { OutcomeSplit } from './OutcomeSplit';
import type { Market } from '@/types';

export function MarketCard({ market, reason }: { market: Market; reason?: string }) {
  const up = market.change24h >= 0;
  const flat = Math.round(market.change24h * 100) === 0;
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.975, useNativeDriver: true, speed: 40 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => router.push(`/market/${encodeURIComponent(market.id)}`)}
      >
        <View style={styles.topRow}>
          <View style={styles.metaRow}>
            <PlatformBadge platform={market.platform} />
            <View
              style={[styles.catDot, { backgroundColor: categoryColors[market.category] ?? colors.textFaint }]}
            />
            <Text style={styles.category}>{market.category.toUpperCase()}</Text>
          </View>
          <SignalChip signal={market.signal} />
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {market.title}
        </Text>

        {reason && (
          <View style={styles.reasonRow}>
            <View style={styles.reasonDot} />
            <Text style={styles.reason} numberOfLines={1}>
              {reason}
            </Text>
          </View>
        )}

        <OutcomeSplit market={market} />

        <View style={styles.bottomRow}>
          <View style={styles.oddsBlock}>
            {!flat && (
              <View
                style={[styles.deltaPill, { backgroundColor: up ? colors.upDim : colors.downDim }]}
              >
                <Text style={[styles.deltaText, { color: up ? colors.up : colors.down }]}>
                  {signedPct(market.change24h)} today
                </Text>
              </View>
            )}
          </View>
          <View style={styles.statBlock}>
            <Stat label="Vol" value={compactUsd(market.volume)} />
            <Stat label="Score" value={market.aiScore != null ? String(market.aiScore) : '—'} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...card,
    gap: spacing.md,
  },
  cardPressed: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  category: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textFaint },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  title: { ...typography.heading, color: colors.text, lineHeight: 22 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -spacing.xs },
  reasonDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  reason: { fontSize: 12, color: colors.accent, fontWeight: '600', flex: 1 },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.xs,
  },
  oddsBlock: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prob: { ...typography.monoLarge, color: colors.text },
  deltaPill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  deltaText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statBlock: { flexDirection: 'row', gap: spacing.lg },
  stat: { alignItems: 'flex-end' },
  statValue: { ...typography.mono, color: colors.textMuted, fontSize: 14 },
  statLabel: { fontSize: 10, color: colors.textFaint, marginTop: 1 },
});
