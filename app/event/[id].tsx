import { useMemo } from 'react';
import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { colors, radius, spacing, typography, card } from '@/theme';
import { getMarketSource } from '@/services/markets';
import { groupMarkets, isEventGroup } from '@/services/markets/grouping';
import { PlatformBadge } from '@/components/Chip';
import { CardSkeleton } from '@/components/Skeleton';
import { Enter } from '@/components/motion';
import { compactUsd, signedPct } from '@/lib/format';
import type { EventGroup, Market } from '@/types';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = decodeURIComponent(id ?? '');
  const source = useMemo(() => getMarketSource(), []);

  const { data: group, isLoading } = useQuery<EventGroup | null>({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const all = await source.listMarkets();
      const found = groupMarkets(all).find((it) => isEventGroup(it) && it.eventId === eventId);
      return (found as EventGroup) ?? null;
    },
  });

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <CardSkeleton count={2} />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.empty}>
        <Stack.Screen options={{ title: 'Event' }} />
        <Ionicons name="albums-outline" size={28} color={colors.textFaint} />
        <Text style={styles.emptyTitle}>Event unavailable</Text>
        <Text style={styles.emptyBody}>These outcomes may have resolved or dropped below the volume floor.</Text>
      </View>
    );
  }

  const leader = group.outcomes[0];

  return (
    <FlatList
      data={group.outcomes}
      keyExtractor={(o) => o.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <Enter>
          <Stack.Screen options={{ title: 'Event' }} />
          <View style={styles.headMeta}>
            <PlatformBadge platform={leader.platform} size="md" />
            <Text style={styles.count}>{group.outcomes.length} outcomes</Text>
          </View>
          <Text style={styles.title}>{group.title}</Text>
          <View style={styles.statStrip}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{Math.round(leader.probability * 100)}%</Text>
              <Text style={styles.statLabel}>leader</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{compactUsd(group.totalVolume)}</Text>
              <Text style={styles.statLabel}>total volume</Text>
            </View>
          </View>
          <Text style={styles.sectionLabel}>OUTCOMES</Text>
        </Enter>
      }
      renderItem={({ item, index }) => (
        <Enter index={Math.min(index, 8)}>
          <OutcomeRow outcome={item} rank={index + 1} />
        </Enter>
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
    />
  );
}

function OutcomeRow({ outcome, rank }: { outcome: Market; rank: number }) {
  const up = outcome.change24h >= 0;
  const flat = Math.round(outcome.change24h * 100) === 0;
  const lead = rank === 1;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceElevated }]}
      onPress={() => router.push(`/market/${encodeURIComponent(outcome.id)}`)}
      accessibilityRole="button"
      accessibilityLabel={`${outcome.outcomeLabel ?? outcome.title}, ${Math.round(outcome.probability * 100)} percent`}
    >
      <Text style={[styles.rank, lead && { color: colors.up }]}>{rank}</Text>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.label} numberOfLines={1}>
          {outcome.outcomeLabel ?? outcome.title}
        </Text>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.max(3, Math.round(outcome.probability * 100))}%`, backgroundColor: lead ? colors.up : colors.accent },
            ]}
          />
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.prob}>{Math.round(outcome.probability * 100)}%</Text>
        {!flat && (
          <Text style={[styles.delta, { color: up ? colors.up : colors.down }]}>{signedPct(outcome.change24h)}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  loading: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  headMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  count: { ...typography.caption, color: colors.textFaint },
  title: { ...typography.title, color: colors.text, marginTop: spacing.sm, lineHeight: 26 },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.monoLarge, color: colors.text, fontSize: 20 },
  statLabel: { fontSize: 10, color: colors.textFaint, marginTop: 2 },
  statDivider: { width: 1, height: 26, backgroundColor: colors.border },
  sectionLabel: { ...typography.kicker, color: colors.textFaint, marginTop: spacing.xl, marginBottom: spacing.sm },
  row: { ...card, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rank: { ...typography.mono, fontSize: 14, color: colors.textFaint, width: 16, textAlign: 'center' },
  label: { ...typography.bodyStrong, color: colors.text, fontSize: 15 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  rowRight: { alignItems: 'flex-end', minWidth: 48 },
  prob: { ...typography.mono, color: colors.text, fontSize: 16 },
  delta: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  empty: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyTitle: { ...typography.heading, color: colors.textMuted },
  emptyBody: { ...typography.caption, color: colors.textFaint, textAlign: 'center', lineHeight: 18 },
});
