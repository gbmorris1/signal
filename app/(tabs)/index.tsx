import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, Text, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { colors, radius, spacing, typography } from '@/theme';
import { getMarketSource } from '@/services/markets';
import { recommendFeedDetailed } from '@/services/recommend';
import { MarketCard } from '@/components/MarketCard';
import { EventCard } from '@/components/EventCard';
import { CardSkeleton } from '@/components/Skeleton';
import { TrackRecordCard } from '@/components/TrackRecordCard';
import { groupMarkets, isEventGroup, type FeedItem } from '@/services/markets/grouping';
import { AnimatedNumber, Enter } from '@/components/motion';
import { signedPct } from '@/lib/format';
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
  const [showHow, setShowHow] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { data = [], isLoading, refetch } = useQuery<Market[]>({
    queryKey: ['markets', 'briefing'],
    queryFn: () => source.listMarkets(),
  });

  const onRefresh = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const interests = profile?.interests ?? [];
  const experience = profile?.experience ?? 'active';

  const briefing = useMemo(
    () =>
      recommendFeedDetailed({ markets: data, interests, experience })
        .filter((r) => r.market.signal === 'opportunity' || r.market.signal === 'watch')
        .slice(0, 12),
    [data, interests, experience],
  );

  // Collapse multi-outcome legs into event cards, keeping each standalone
  // market's "why it surfaced" reason.
  const items = useMemo(() => groupMarkets(briefing.map((r) => r.market)), [briefing]);
  const reasonById = useMemo(
    () => new Map(briefing.map((r) => [r.market.id, r.reason])),
    [briefing],
  );

  // Hero stats across the whole tracked universe.
  const biggestMover = useMemo(
    () => [...data].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))[0],
    [data],
  );
  const platforms = new Set(data.map((m) => m.platform)).size;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(it) => (isEventGroup(it) ? it.eventId : it.id)}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {demo && (
              <Pressable style={styles.demoBanner} onPress={() => router.push('/auth')}>
                <Text style={styles.demoText}>Demo mode. Tap to create your account →</Text>
              </Pressable>
            )}
            <Text style={styles.kicker}>{dateKicker()}</Text>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.sub}>
              {isLoading
                ? 'Building your briefing…'
                : `${briefing.length} markets deserve your attention.`}
            </Text>

            {!isLoading && data.length > 0 && (
              <Enter>
                <View style={styles.heroStrip}>
                  <View style={styles.heroStat}>
                    <AnimatedNumber value={data.length} style={styles.heroValue} />
                    <Text style={styles.heroLabel}>markets tracked</Text>
                  </View>
                  <View style={styles.heroDivider} />
                  <Pressable
                    style={styles.heroStat}
                    disabled={!biggestMover}
                    hitSlop={4}
                    onPress={() =>
                      biggestMover &&
                      router.push(`/market/${encodeURIComponent(biggestMover.id)}`)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={
                      biggestMover ? `View ${biggestMover.title}, today's biggest move` : undefined
                    }
                  >
                    <AnimatedNumber
                      value={biggestMover ? biggestMover.change24h * 100 : 0}
                      format={(v) => `${v >= 0 ? '+' : ''}${Math.round(v)}%`}
                      style={[
                        styles.heroValue,
                        {
                          color:
                            biggestMover && biggestMover.change24h < 0 ? colors.down : colors.up,
                        },
                      ]}
                    />
                    <Text style={styles.heroLabel}>biggest move</Text>
                  </Pressable>
                  <View style={styles.heroDivider} />
                  <View style={styles.heroStat}>
                    <AnimatedNumber value={platforms} style={styles.heroValue} />
                    <Text style={styles.heroLabel}>{platforms === 1 ? 'platform' : 'platforms'}</Text>
                  </View>
                </View>
              </Enter>
            )}

            {!isLoading && (
              <Enter>
                <View style={styles.trackWrap}>
                  <TrackRecordCard />
                </View>
              </Enter>
            )}

            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>TODAY'S SIGNALS</Text>
              <Pressable hitSlop={10} onPress={() => setShowHow(true)} style={styles.howBtn}>
                <Ionicons name="information-circle-outline" size={15} color={colors.textFaint} />
                <Text style={styles.howText}>How this works</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item, index }: { item: FeedItem; index: number }) => (
          <Enter index={index}>
            {isEventGroup(item) ? (
              <EventCard group={item} />
            ) : (
              <MarketCard market={item} reason={reasonById.get(item.id)} />
            )}
          </Enter>
        )}
        ListEmptyComponent={
          isLoading ? (
            <CardSkeleton />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle-outline" size={28} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>Nothing urgent today</Text>
              <Text style={styles.emptyBody}>
                Markets are calm. Nothing crossed the opportunity or watch threshold, so browse
                everything else in Discover.
              </Text>
              <Pressable style={styles.emptyCta} onPress={() => router.push('/(tabs)/discover')}>
                <Text style={styles.emptyCtaText}>Browse markets</Text>
              </Pressable>
            </View>
          )
        }
      />

      <HowItWorks visible={showHow} onClose={() => setShowHow(false)} hasInterests={interests.length > 0} />
    </SafeAreaView>
  );
}

function HowItWorks({
  visible,
  onClose,
  hasInterests,
}: {
  visible: boolean;
  onClose: () => void;
  hasInterests: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>How your briefing is built</Text>
          <Text style={styles.sheetBody}>
            ODDIQ scans every live market on Polymarket and Kalshi, then ranks them for you by
            blending four factors:
          </Text>
          <Row icon="trending-up" title="Movement" body="Markets that repriced sharply in the last 24h. That's where new information is landing." />
          <Row icon="water" title="Liquidity" body="Real trading volume. Thin markets produce noisy, unreliable prices." />
          <Row icon="help-circle" title="Uncertainty" body="Contested odds near 50% are open questions; markets at 96%+ are already decided and get filtered out." />
          <Row
            icon="person"
            title="Your interests"
            body={
              hasInterests
                ? 'Markets in categories you picked get boosted. Each card shows why it surfaced.'
                : 'Pick interests in onboarding to personalize this feed. Right now you see the global ranking.'
            }
          />
          <Text style={styles.sheetFoot}>
            Only markets flagged Opportunity or Watch make the briefing. Everything else lives in
            Discover.
          </Text>
          <Pressable style={styles.sheetClose} onPress={onClose}>
            <Text style={styles.sheetCloseText}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.accent} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxl },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg, marginTop: spacing.sm },
  kicker: { ...typography.kicker, color: colors.accent, marginBottom: spacing.xs },
  greeting: { ...typography.display, color: colors.text },
  sub: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  heroStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroValue: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
    color: colors.text,
  },
  heroLabel: { fontSize: 10, color: colors.textFaint, marginTop: 2, letterSpacing: 0.3 },
  heroDivider: { width: 1, height: 26, backgroundColor: colors.border },
  trackWrap: { marginTop: spacing.lg },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  sectionLabel: { ...typography.kicker, color: colors.textFaint },
  howBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  howText: { ...typography.ticker, fontSize: 8.5, color: colors.textFaint },
  demoBanner: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  demoText: { ...typography.ticker, fontSize: 9, color: colors.accent },
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
  emptyCtaText: { ...typography.button, color: colors.bg },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  sheetTitle: { ...typography.title, color: colors.text },
  sheetBody: { ...typography.body, color: colors.textMuted, lineHeight: 21 },
  row: { flexDirection: 'row', gap: spacing.md },
  rowTitle: { ...typography.bodyStrong, color: colors.text },
  rowBody: { ...typography.caption, color: colors.textMuted, lineHeight: 18, marginTop: 2 },
  sheetFoot: { ...typography.caption, color: colors.textFaint, lineHeight: 18 },
  sheetClose: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  sheetCloseText: { ...typography.button, color: colors.bg },
});
