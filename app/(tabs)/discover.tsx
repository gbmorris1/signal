import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors, radius, spacing, typography } from '@/theme';
import { getMarketSource } from '@/services/markets';
import { MarketCard } from '@/components/MarketCard';
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

  const { data = [] } = useQuery<Market[]>({
    queryKey: ['markets', 'all'],
    queryFn: () => source.listMarkets(),
  });

  const filtered = data
    .filter((m: Market) => (category === 'all' ? true : m.category === category))
    .filter((m: Market) => (query ? m.title.toLowerCase().includes(query.toLowerCase()) : true));

  const sorted = [...filtered].sort((a, b) => {
    if (section === 'movers') return Math.abs(b.change24h) - Math.abs(a.change24h);
    if (section === 'ai') return (b.aiScore ?? 0) - (a.aiScore ?? 0);
    return b.volume - a.volume; // trending
  });

  return (
    <FlatList
      data={sorted}
      keyExtractor={(m) => m.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
          <TextInput
            placeholder="Search Fed, Bitcoin, Trump, NBA…"
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={setQuery}
            style={styles.search}
          />
          <Row>
            {SECTIONS.map((s) => (
              <Toggle
                key={s.key}
                label={s.label}
                active={section === s.key}
                onPress={() => setSection(s.key)}
              />
            ))}
          </Row>
          <Row>
            {CATEGORIES.map((c) => (
              <Toggle
                key={c}
                label={c === 'all' ? 'All' : c[0].toUpperCase() + c.slice(1)}
                active={category === c}
                onPress={() => setCategory(c)}
              />
            ))}
          </Row>
        </View>
      }
      renderItem={({ item }) => <MarketCard market={item} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListEmptyComponent={<Text style={styles.empty}>No markets match.</Text>}
    />
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function Toggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggle, active && { backgroundColor: colors.accentDim, borderColor: colors.accent }]}
    >
      <Text style={[styles.toggleText, active && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  search: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    ...typography.body,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toggle: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  toggleText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  empty: { color: colors.textFaint, textAlign: 'center', marginTop: spacing.xl },
});
