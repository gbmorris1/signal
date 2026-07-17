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
import { SwipeableRow } from '@/components/SwipeableRow';
import { Enter } from '@/components/motion';
import { useWatchlist } from '@/state/watchlist';
import { signedPct } from '@/lib/format';
import type { Market } from '@/types';

type SortKey = 'recent' | 'mover' | 'volume';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'mover', label: 'Movers' },
  { key: 'volume', label: 'Volume' },
];

export default function WatchlistScreen() {
  const source = useMemo(() => getMarketSource(), []);
  const { ids, toggle } = useWatchlist();
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortKey>('recent');
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

  // `ids` is insertion-ordered (oldest first); "Recent" wants newest first.
  const saved = useMemo(() => {
    const list = data.filter((m: Market) => ids.includes(m.id));
    if (sort === 'mover') return [...list].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));
    if (sort === 'volume') return [...list].sort((a, b) => b.volume - a.volume);
    const order = new Map(ids.map((id, i) => [id, i]));
    return [...list].sort((a, b) => (order.get(b.id) ?? 0) - (order.get(a.id) ?? 0));
  }, [data, ids, sort]);

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
          <View style={styles.header}>
            <Text style={styles.kicker}>
              {saved.length} {saved.length === 1 ? 'MARKET' : 'MARKETS'} WATCHED
            </Text>
            <View style={styles.segment}>
              {SORTS.map((s) => {
                const active = sort === s.key;
                return (
                  <Pressable
                    key={s.key}
                    style={[styles.segmentTab, active && styles.segmentActive]}
                    onPress={() => {
                      if (!active) void Haptics.selectionAsync();
                      setSort(s.key);
                    }}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null
      }
      renderItem={({ item, index }) => (
        <Enter index={index}>
          <SwipeableRow onRemove={() => remove(item)}>
            <WatchRow market={item} onRemove={() => remove(item)} />
          </SwipeableRow>
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
  header: { marginBottom: spacing.lg, gap: spacing.md },
  kicker: { ...typography.kicker, color: colors.textFaint },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 3,
  },
  segmentTab: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center', borderRadius: radius.md - 3 },
  segmentActive: { backgroundColor: colors.surfaceElevated },
  segmentText: { color: colors.textFaint, fontWeight: '700', fontSize: 13 },
  segmentTextActive: { color: colors.text },
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
