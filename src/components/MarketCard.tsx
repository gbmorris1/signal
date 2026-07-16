import { Pressable, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { pct, signedPct, compactUsd } from '@/lib/format';
import { SignalChip } from './Chip';
import type { Market } from '@/types';

export function MarketCard({ market }: { market: Market }) {
  const up = market.change24h >= 0;
  const flat = Math.round(market.change24h * 100) === 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/market/${encodeURIComponent(market.id)}`)}
    >
      <View style={styles.topRow}>
        <Text style={styles.meta}>
          {market.category} · {market.platform}
        </Text>
        <SignalChip signal={market.signal} />
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {market.title}
      </Text>

      <View style={styles.bottomRow}>
        <View style={styles.oddsBlock}>
          <Text style={styles.prob}>{pct(market.probability)}</Text>
          {!flat && (
            <View style={[styles.deltaPill, { backgroundColor: up ? colors.upDim : colors.downDim }]}>
              <Text style={[styles.deltaText, { color: up ? colors.up : colors.down }]}>
                {signedPct(market.change24h)}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.statBlock}>
          <Stat label="Vol" value={compactUsd(market.volume)} />
          <Stat label="Signal score" value={market.aiScore != null ? String(market.aiScore) : '—'} />
        </View>
      </View>
    </Pressable>
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardPressed: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { ...typography.kicker, color: colors.textFaint },
  title: { ...typography.heading, color: colors.text, lineHeight: 22 },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.xs,
  },
  oddsBlock: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prob: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  deltaPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  deltaText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statBlock: { flexDirection: 'row', gap: spacing.lg },
  stat: { alignItems: 'flex-end' },
  statValue: { ...typography.mono, color: colors.textMuted, fontSize: 14 },
  statLabel: { fontSize: 10, color: colors.textFaint, marginTop: 1 },
});
