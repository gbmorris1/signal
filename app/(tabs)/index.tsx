import { useMemo } from 'react';
import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

function dateKicker(): string {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .toUpperCase();
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

  // Personalized briefing: rank by recommendation, surface what deserves attention.
  const ranked = recommendFeed({ markets: data, interests, experience });
  const briefing = ranked
    .filter((m) => m.signal === 'opportunity' || m.signal === 'watch')
    .slice(0, 12);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={briefing}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            {demo && (
              <Pressable style={styles.demoBanner} onPress={() => router.push('/auth')}>
                <Text style={styles.demoText}>Demo mode — tap to create your account →</Text>
              </Pressable>
            )}
            <Text style={styles.kicker}>{dateKicker()}</Text>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.sub}>
              {isLoading
                ? 'Building your briefing…'
                : `${briefing.length} markets deserve your attention.`}
            </Text>
            <Text style={styles.sectionLabel}>TODAY'S SIGNALS</Text>
          </View>
        }
        renderItem={({ item }) => <MarketCard market={item} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.lg, marginTop: spacing.sm },
  kicker: { ...typography.kicker, color: colors.accent, marginBottom: spacing.xs },
  greeting: { ...typography.display, color: colors.text },
  sub: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  sectionLabel: { ...typography.kicker, color: colors.textFaint, marginTop: spacing.xl },
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
