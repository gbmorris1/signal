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
import { colors, categoryColors, radius, spacing, typography, card } from '@/theme';
import { getMarketSource } from '@/services/markets';
import { MarketCard } from '@/components/MarketCard';
import { PlatformBadge } from '@/components/Chip';
import { Enter } from '@/components/motion';
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
  { key: 'movers', label: 'Biggest Movers' },
  { key: 'ai', label: 'AI Opportunities' },
];

export default function DiscoverScreen() {
  const source = useMemo(() => getMarketSource(), []);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [section, setSection] = useState<Section>('trending');
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

  const filtered = data
    .filter((m: Market) => (category === 'all' ? true : m.category === category))
    .filter((m: Market) => (searching ? m.title.toLowerCase().includes(query.toLowerCase()) : true));

  const sorted = [...filtered].sort((a, b) => {
    if (section === 'movers') return Math.abs(b.change24h) - Math.abs(a.change24h);
    if (section === 'ai') return (b.aiScore ?? 0) - (a.aiScore ?? 0);
    return b.volume - a.volume; // trending
  });

  // Horizontal rail: top movers across everything (independent of filters).
  const rail = [...data]
    .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
    .slice(0, 8);

  return (
    <FlatList
      data={sorted}
      keyExtractor={(m) => m.id}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      ListHeaderComponent={
        <View style={{ gap: spacing.lg, marginBottom: spacing.md }}>
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
              <Pressable hitSlop={8} onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textFaint} />
              </Pressable>
            )}
          </View>

          {!searching && rail.length > 0 && (
            <View>
              <Text style={styles.railLabel}>ON THE MOVE</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rail}
              >
                {rail.map((m, i) => (
                  <Enter key={m.id} index={i}>
                    <RailCard market={m} />
                  </Enter>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.row}>
            {SECTIONS.map((s) => (
              <Toggle
                key={s.key}
                label={s.label}
                active={section === s.key}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSection(s.key);
                }}
              />
            ))}
          </View>
          <View style={styles.row}>
            {CATEGORIES.map((c) => (
              <Toggle
                key={c}
                label={c === 'all' ? 'All' : c[0].toUpperCase() + c.slice(1)}
                active={category === c}
                tint={c !== 'all' ? categoryColors[c] : undefined}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setCategory(c);
                }}
              />
            ))}
          </View>
        </View>
      }
      renderItem={({ item, index }) => (
        <Enter index={Math.min(index, 6)}>
          <MarketCard market={item} />
        </Enter>
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListEmptyComponent={
        isLoading ? (
          <View style={{ gap: spacing.md }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skeleton}>
                <View style={[styles.bone, { width: '30%' }]} />
                <View style={[styles.bone, { width: '85%', height: 16 }]} />
                <View style={[styles.bone, { width: '40%', height: 24, marginTop: spacing.sm }]} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="telescope-outline" size={28} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>Nothing matches</Text>
            <Text style={styles.emptyBody}>
              {searching
                ? `No markets match “${query}”. Try a broader term like “Fed” or “Bitcoin”.`
                : 'No markets in this category right now — check back after the next sync.'}
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

function Toggle({
  label,
  active,
  tint,
  onPress,
}: {
  label: string;
  active: boolean;
  tint?: string;
  onPress: () => void;
}) {
  const activeColor = tint ?? colors.accent;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.toggle,
        active && { backgroundColor: `${activeColor}22`, borderColor: activeColor },
      ]}
    >
      <Text style={[styles.toggleText, active && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  search: { flex: 1, paddingVertical: spacing.md, color: colors.text, ...typography.body },
  railLabel: { ...typography.kicker, color: colors.textFaint, marginBottom: spacing.sm },
  rail: { gap: spacing.sm, paddingRight: spacing.lg },
  railCard: {
    width: 168,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  railTitle: { fontSize: 13, fontWeight: '600', color: colors.text, lineHeight: 17, minHeight: 34 },
  railStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  railProb: { ...typography.mono, color: colors.text, fontSize: 16 },
  railDelta: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toggle: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  toggleText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  skeleton: {
    ...card,
    gap: spacing.sm,
  },
  bone: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceElevated },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.heading, color: colors.textMuted },
  emptyBody: { ...typography.caption, color: colors.textFaint, textAlign: 'center', lineHeight: 18 },
});
