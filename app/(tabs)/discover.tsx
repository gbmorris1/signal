import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { colors, categoryColors, radius, spacing, typography } from '@/theme';
import { getMarketSource } from '@/services/markets';
import { MarketCard } from '@/components/MarketCard';
import { EventCard } from '@/components/EventCard';
import { CardSkeleton } from '@/components/Skeleton';
import { PlatformBadge } from '@/components/Chip';
import { groupMarkets, isEventGroup } from '@/services/markets/grouping';
import { pct, signedPct } from '@/lib/format';
import type { Category, Market } from '@/types';

const CATEGORIES: (Category | 'all')[] = [
  'all',
  'politics',
  'finance',
  'crypto',
  'sports',
  'world',
  'technology',
];

type Section = 'trending' | 'movers' | 'ai';
const SECTIONS: { key: Section; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'movers', label: 'Movers' },
  { key: 'ai', label: 'AI picks' },
];

// Odds-band screener: the mobile-friendly form of a probability-range filter.
type OddsBand = 'any' | 'longshot' | 'tossup' | 'favorite';
const ODDS_BANDS: { key: OddsBand; label: string; test: (p: number) => boolean }[] = [
  { key: 'any', label: 'Any odds', test: () => true },
  { key: 'longshot', label: 'Longshots', test: (p) => p < 0.25 },
  { key: 'tossup', label: 'Toss-ups', test: (p) => p >= 0.4 && p <= 0.6 },
  { key: 'favorite', label: 'Favorites', test: (p) => p > 0.75 },
];

export default function DiscoverScreen() {
  const source = useMemo(() => getMarketSource(), []);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [section, setSection] = useState<Section>('trending');
  const [oddsBand, setOddsBand] = useState<OddsBand>('any');
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

  const searching = query.trim().length > 0;

  // Memoized pipeline: hundreds of markets, so recompute only when inputs
  // change, and cap what we hand the list. 100 rows is beyond what anyone
  // scrolls, and it keeps filter taps instant.
  const sorted = useMemo(() => {
    const q = query.toLowerCase();
    const bandTest = ODDS_BANDS.find((b) => b.key === oddsBand)!.test;
    const filtered = data
      .filter((m: Market) => (category === 'all' ? true : m.category === category))
      .filter((m: Market) => bandTest(m.probability))
      .filter((m: Market) => (searching ? m.title.toLowerCase().includes(q) : true));
    return filtered
      .sort((a, b) => {
        if (section === 'movers') return Math.abs(b.change24h) - Math.abs(a.change24h);
        if (section === 'ai') return (b.aiScore ?? 0) - (a.aiScore ?? 0);
        return b.volume - a.volume; // trending
      })
      .slice(0, 100);
  }, [data, category, section, oddsBand, query, searching]);

  // Collapse multi-outcome legs into single event cards for the feed.
  const items = useMemo(() => groupMarkets(sorted), [sorted]);

  // Horizontal rail: sharpest movers across everything. Always rendered (when
  // not searching) so the header layout never jumps between sections.
  const rail = useMemo(
    () =>
      [...data]
        .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
        .slice(0, 8),
    [data],
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(it) => (isEventGroup(it) ? it.eventId : it.id)}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={8}
      maxToRenderPerBatch={10}
      windowSize={7}
      removeClippedSubviews
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      ListHeaderComponent={
        <View style={[styles.header, { gap: spacing.lg, marginBottom: spacing.md }]}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.textFaint} />
            <TextInput
              placeholder="Search Fed, Bitcoin, Trump, NBA…"
              placeholderTextColor={colors.textFaint}
              value={query}
              onChangeText={setQuery}
              style={styles.search}
              returnKeyType="search"
            />
            {searching && (
              <Pressable
                hitSlop={8}
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={16} color={colors.textFaint} />
              </Pressable>
            )}
          </View>

          {!searching && (
            <Pressable
              style={styles.spreadsBtn}
              onPress={() => router.push('/spreads')}
              accessibilityRole="button"
              accessibilityLabel="View cross-platform spreads"
            >
              <Ionicons name="swap-horizontal" size={15} color={colors.accent} />
              <Text style={styles.spreadsText}>Cross-platform spreads</Text>
              <View style={{ flex: 1 }} />
              <Ionicons name="chevron-forward" size={14} color={colors.textFaint} />
            </Pressable>
          )}

          {/* Folded into the Movers segment rather than always-on: four
              stacked filter rows above the first result was too much chrome
              on every visit to Trending/AI picks. */}
          {!searching && section === 'movers' && (
            <View style={styles.railBlock}>
              <Text style={styles.railLabel}>ON THE MOVE</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rail}
              >
                {rail.map((m) => (
                  <RailCard key={m.id} market={m} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Segmented view control: exactly one is always active by design. */}
          <View style={styles.segment}>
            {SECTIONS.map((s) => {
              const active = section === s.key;
              return (
                <Pressable
                  key={s.key}
                  style={[styles.segmentTab, active && styles.segmentActive]}
                  onPress={() => {
                    if (!active) void Haptics.selectionAsync();
                    setSection(s.key);
                  }}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {CATEGORIES.map((c) => {
              const active = category === c;
              const tint = c !== 'all' ? categoryColors[c] : colors.accent;
              return (
                <Pressable
                  key={c}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setCategory(active ? 'all' : c);
                  }}
                  style={[styles.chip, active && { backgroundColor: `${tint}22`, borderColor: tint }]}
                >
                  <Text style={[styles.chipText, active && { color: colors.text }]}>
                    {c === 'all' ? 'All' : c[0].toUpperCase() + c.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {ODDS_BANDS.map((b) => {
              const active = oddsBand === b.key;
              return (
                <Pressable
                  key={b.key}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setOddsBand(b.key);
                  }}
                  style={[styles.chip, active && { backgroundColor: colors.accentDim, borderColor: colors.accent }]}
                >
                  <Text style={[styles.chipText, active && { color: colors.text }]}>{b.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      }
      renderItem={({ item }) =>
        isEventGroup(item) ? <EventCard group={item} /> : <MarketCard market={item} />
      }
      ListEmptyComponent={
        isLoading ? (
          <CardSkeleton />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="telescope-outline" size={28} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>Nothing matches</Text>
            <Text style={styles.emptyBody}>
              {searching
                ? `No markets match “${query}”. Try a broader term like “Fed” or “Bitcoin”.`
                : oddsBand !== 'any' || category !== 'all'
                  ? 'No markets match these filters. Try widening the odds band or category.'
                  : 'No markets right now. Check back after the next sync.'}
            </Text>
          </View>
        )
      }
    />
  );
}

/** Compact horizontal-rail card: the fastest-moving markets at a glance. */
function RailCard({ market }: { market: Market }) {
  const up = market.change24h >= 0;
  return (
    <Pressable
      style={({ pressed }) => [styles.railCard, pressed && { backgroundColor: colors.surfaceElevated }]}
      onPress={() => router.push(`/market/${encodeURIComponent(market.id)}`)}
    >
      <PlatformBadge platform={market.platform} />
      <Text style={styles.railTitle} numberOfLines={2}>
        {market.title}
      </Text>
      <View style={styles.railStats}>
        <Text style={styles.railProb}>{pct(market.probability)}</Text>
        <Text style={[styles.railDelta, { color: up ? colors.up : colors.down }]}>
          {signedPct(market.change24h)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderColor: colors.rule,
    borderWidth: 1,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.md,
  },
  search: { flex: 1, paddingVertical: spacing.md, color: colors.text, ...typography.body },
  spreadsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderColor: colors.rule,
    borderWidth: 1,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  spreadsText: { ...typography.heading, fontSize: 14, color: colors.text },
  railBlock: { minHeight: 124 },
  railLabel: { ...typography.ticker, color: colors.textFaint, marginBottom: spacing.sm },
  rail: { gap: spacing.sm, paddingRight: spacing.lg },
  railCard: {
    width: 160,
    borderColor: colors.rule,
    borderWidth: 1,
    borderRadius: radius.xs,
    padding: spacing.md,
    gap: spacing.sm,
  },
  railTitle: { ...typography.heading, fontSize: 13, color: colors.text, minHeight: 34 },
  railStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  railProb: { ...typography.stat, fontSize: 15, color: colors.text },
  railDelta: { ...typography.statSmall, fontSize: 11 },
  // Squared segmented control, terminal-style.
  segment: {
    flexDirection: 'row',
    borderRadius: radius.xs,
    borderColor: colors.rule,
    borderWidth: 1,
    padding: 2,
  },
  segmentTab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.xs },
  segmentActive: { backgroundColor: colors.surfaceHigh },
  segmentText: { ...typography.ticker, fontSize: 9, color: colors.textFaint },
  segmentTextActive: { color: colors.text },
  chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipText: { ...typography.ticker, fontSize: 9, color: colors.textMuted },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.heading, color: colors.textMuted },
  emptyBody: { ...typography.caption, color: colors.textFaint, textAlign: 'center', lineHeight: 18 },
});
