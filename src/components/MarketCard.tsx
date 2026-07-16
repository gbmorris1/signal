import { Pressable, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { pct, signedPct, compactUsd } from '@/lib/format';
import { SignalChip } from './Chip';
import type { Market } from '@/types';

export function MarketCard({ market }: { market: Market }) {
  const up = market.change24h >= 0;
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/market/${encodeURIComponent(market.id)}`)}
    >
      <View style={styles.headerRow}>
        <SignalChip signal={market.signal} />
        <Text style={styles.platform}>{market.platform}</Text>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {market.title}
      </Text>

      <View style={styles.statsRow}>
        <View>
          <Text style={styles.prob}>{pct(market.probability)}</Text>
          <Text style={styles.statLabel}>probability</Text>
        </View>
        <View>
          <Text style={[styles.change, { color: up ? colors.up : colors.down }]}>
            {signedPct(market.change24h)}
          </Text>
          <Text style={styles.statLabel}>24h</Text>
        </View>
        <View>
          <Text style={styles.volume}>{compactUsd(market.volume)}</Text>
          <Text style={styles.statLabel}>volume</Text>
        </View>
        <View>
          <Text style={styles.score}>{market.aiScore ?? '—'}</Text>
          <Text style={styles.statLabel}>AI score</Text>
        </View>
      </View>
    </Pressable>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  platform: { color: colors.textFaint, fontSize: 12, textTransform: 'capitalize' },
  title: { ...typography.heading, color: colors.text },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  prob: { ...typography.mono, color: colors.text, fontSize: 20 },
  change: { ...typography.mono, fontSize: 20 },
  volume: { ...typography.mono, color: colors.text, fontSize: 16 },
  score: { ...typography.mono, color: colors.accent, fontSize: 16 },
  statLabel: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
});
