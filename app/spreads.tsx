import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { colors, radius, spacing, typography } from '@/theme';
import { getCombinedSource } from '@/services/markets';
import { PlatformBadge } from '@/components/Chip';
import { CardSkeleton } from '@/components/Skeleton';
import { Enter } from '@/components/motion';
import { pct } from '@/lib/format';
import type { SpreadPair } from '@/services/markets/combinedSource';

export default function SpreadsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { data = [], isLoading, refetch, isFetched } = useQuery<SpreadPair[]>({
    queryKey: ['spreads'],
    queryFn: async () => (await getCombinedSource()?.findSpreads()) ?? [],
  });

  const onRefresh = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <FlatList
      data={data}
      keyExtractor={(p) => `${p.polymarket.id}|${p.kalshi.id}`}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      ListHeaderComponent={
        data.length > 0 ? (
          <View style={styles.intro}>
            <Text style={styles.introText}>
              The same question priced differently on Polymarket vs Kalshi, biggest gap first. A wide
              spread often means the two markets resolve on{' '}
              <Text style={{ color: colors.text, fontWeight: '700' }}>different criteria</Text>, so
              read both before assuming it's free money.
            </Text>
          </View>
        ) : null
      }
      renderItem={({ item, index }) => (
        <Enter index={Math.min(index, 6)}>
          <SpreadCard pair={item} />
        </Enter>
      )}
      ListEmptyComponent={
        isLoading || !isFetched ? (
          <CardSkeleton />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="swap-horizontal-outline" size={28} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>No spreads right now</Text>
            <Text style={styles.emptyBody}>
              No questions currently listed on both Polymarket and Kalshi are priced far enough apart
              to flag. Pull to refresh, or check back after the next sync.
            </Text>
          </View>
        )
      }
    />
  );
}

function SpreadCard({ pair }: { pair: SpreadPair }) {
  const big = pair.gapPts >= 8;
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={2}>
          {pair.polymarket.title}
        </Text>
        <View style={[styles.gapPill, { backgroundColor: big ? colors.warnDim : colors.accentDim }]}>
          <Text style={[styles.gapText, { color: big ? colors.warn : colors.accent }]}>
            Δ {pair.gapPts} pts
          </Text>
        </View>
      </View>
      <VenueRow market={pair.polymarket} cheaper={pair.cheaper === 'polymarket'} />
      <VenueRow market={pair.kalshi} cheaper={pair.cheaper === 'kalshi'} />
    </View>
  );
}

function VenueRow({ market, cheaper }: { market: SpreadPair['polymarket']; cheaper: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.venueRow, pressed && { backgroundColor: colors.surfaceElevated }]}
      onPress={() => router.push(`/market/${encodeURIComponent(market.id)}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${market.platform} market, YES at ${Math.round(market.probability * 100)} percent`}
    >
      <PlatformBadge platform={market.platform} />
      {cheaper && (
        <View style={styles.cheapTag}>
          <Text style={styles.cheapText}>YES cheaper</Text>
        </View>
      )}
      <View style={{ flex: 1 }} />
      <Text style={styles.prob}>{pct(market.probability)}</Text>
      <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, flexGrow: 1 },
  intro: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, marginBottom: spacing.sm },
  introText: { ...typography.prose, fontSize: 13, color: colors.textMuted },
  card: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { ...typography.heading, color: colors.text, flex: 1 },
  gapPill: { borderRadius: radius.xs, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  gapText: { ...typography.stat, fontSize: 11 },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  cheapTag: {
    backgroundColor: colors.accentDim,
    borderRadius: radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cheapText: { ...typography.ticker, fontSize: 8, color: colors.accent },
  prob: { ...typography.stat, fontSize: 15, color: colors.text },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.heading, color: colors.textMuted },
  emptyBody: { ...typography.caption, color: colors.textFaint, textAlign: 'center', lineHeight: 18 },
});
