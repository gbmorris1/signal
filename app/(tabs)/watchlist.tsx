import { useMemo } from 'react';
import { FlatList, Text, View, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography } from '@/theme';
import { getMarketSource } from '@/services/markets';
import { MarketCard } from '@/components/MarketCard';
import { useWatchlist } from '@/state/watchlist';
import type { Market } from '@/types';

export default function WatchlistScreen() {
  const source = useMemo(() => getMarketSource(), []);
  const { ids } = useWatchlist();
  const { data = [] } = useQuery<Market[]>({
    queryKey: ['markets', 'all'],
    queryFn: () => source.listMarkets(),
  });

  const saved = data.filter((m: Market) => ids.includes(m.id));

  return (
    <FlatList
      data={saved}
      keyExtractor={(m) => m.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<Text style={styles.title}>Your watchlist</Text>}
      renderItem={({ item }) => <MarketCard market={item} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListEmptyComponent={
        <Text style={styles.empty}>
          No saved markets yet. Open a market and tap “Save” to track it here.
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.lg },
  empty: { color: colors.textFaint, marginTop: spacing.xl, lineHeight: 20 },
});
