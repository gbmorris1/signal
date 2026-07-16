import { useMemo } from 'react';
import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { colors, radius, spacing, typography } from '@/theme';
import { getMarketSource } from '@/services/markets';
import { recommendFeed } from '@/services/recommend';
import { MarketCard } from '@/components/MarketCard';
import { useAuth } from '@/state/auth';
import type { Market } from '@/types';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning.';
  if (h < 18) return 'Good afternoon.';
  return 'Good evening.';
}

export default function HomeScreen() {
  const source = useMemo(() => getMarketSource(), []);
  const { profile, demo } = useAuth();
  const { data = [], isLoading } = useQuery<Market[]>({
    queryKey: ['markets', 'briefing'],
    queryFn: () => source.listMarkets(),
  });

  const interests = profile?.interests ?? [];
  const experience = profile?.experience ?? 'active';

  // Personalized briefing: rank by recommendation, then surface those that
  // "deserve attention" (opportunity / watch signals) at the top.
  const ranked = recommendFeed({ markets: data, interests, experience });
  const briefing = ranked.filter((m) => m.signal === 'opportunity' || m.signal === 'watch');

  return (
    <FlatList
      data={briefing}
      keyExtractor={(m) => m.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          {demo && (
            <Pressable style={styles.demoBanner} onPress={() => router.push('/auth')}>
              <Text style={styles.demoText}>You're in demo mode — tap to create your account →</Text>
            </Pressable>
          )}
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.sub}>
            {isLoading
              ? 'Loading your briefing…'
              : `${briefing.length} prediction markets deserve attention today.`}
          </Text>
        </View>
      }
      renderItem={({ item }) => <MarketCard market={item} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.lg },
  greeting: { ...typography.display, color: colors.text },
  sub: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  demoBanner: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  demoText: { color: colors.text, ...typography.caption, fontWeight: '600' },
});
