import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { colors, radius, spacing, typography, card } from '@/theme';
import { getMarketSource } from '@/services/markets';
import { PlatformBadge } from '@/components/Chip';
import { OutcomeSplit } from '@/components/OutcomeSplit';
import { Enter } from '@/components/motion';
import { useWatchlist } from '@/state/watchlist';
import { signedPct } from '@/lib/format';
import type { Market } from '@/types';

export default function WatchlistScreen() {
  const source = useMemo(() => getMarketSource(), []);
  const { ids, toggle } = useWatchlist();
  const [refreshing, setRefreshing] = useState(false);
  const { data = [], isLoading, refetch } = useQuery<Market[]>({
    queryKey: ['markets', 'all'],
    queryFn: () => source.listMarkets(),
  });

  const onRefresh = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const saved = data.filter((m: Market) => ids.includes(m.id));

  function remove(market: Market) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggle(market);
  }

  return (
    <FlatList
      data={saved}
      keyExtractor={(m) => m.id}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      ListHeaderComponent={
        saved.length > 0 ? (
          <Text style={styles.kicker}>
            {saved.length} {saved.length === 1 ? 'MARKET' : 'MARKETS'} WATCHED
          </Text>
        ) : null
      }
      renderItem={({ item, index }) => (
        <Enter index={index}>
          <WatchRow market={item} onRemove={() => remove(item)} />
        </Enter>
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListEmptyComponent={
        isLoading ? null : (
          <View style={styles.empty}>
            <Ionicons name="star-outline" size={28} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>Nothing watched yet</Text>
            <Text style={styles.emptyBody}>
              Open any market and tap “Save to watchlist”. Watched markets that move sharply will
              trigger alerts.
            </Text>
            <Pressable style={styles.emptyCta} onPress={() => router.push('/(tabs)/discover')}>
              <Text style={styles.emptyCtaText}>Browse markets</Text>
            </Pressable>
          </View>
        )
      }
    />
  );
}

/** Compact watch row: platform, title, both outcomes, 24h move, remove. */
function WatchRow({ market, onRemove }: { market: Market; onRemove: () => void }) {
  const up = market.change24h >= 0;
  const flat = Math.round(market.change24h * 100) === 0;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceElevated }]}
      onPress={() => router.push(`/market/${encodeURIComponent(market.id)}`)}
    >
      <View style={styles.rowHead}>
        <PlatformBadge platform={market.platform} />
        {!flat && (
          <Text style={[styles.delta, { color: up ? colors.up : colors.down }]}>
            {signedPct(market.change24h)} today
          </Text>
        )}
        <Pressable hitSlop={10} onPress={onRemove} style={styles.trash}>
          <Ionicons name="close" size={16} color={colors.textFaint} />
        </Pressable>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {market.title}
      </Text>
      <OutcomeSplit market={market} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  kicker: { ...typography.kicker, color: colors.textFaint, marginBottom: spacing.lg },
  row: {
    ...card,
    gap: spacing.md,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  delta: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'], flex: 1 },
  trash: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.heading, color: colors.text, lineHeight: 22 },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.heading, color: colors.textMuted },
  emptyBody: { ...typography.caption, color: colors.textFaint, textAlign: 'center', lineHeight: 18 },
  emptyCta: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  emptyCtaText: { color: colors.bg, fontWeight: '700' },
});
