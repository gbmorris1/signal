import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { colors, radius, spacing, typography } from '@/theme';
import { getMarketSource } from '@/services/markets';
import { recommendFeedDetailed, type RankedMarket } from '@/services/recommend';
import { MarketCard } from '@/components/MarketCard';
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
  const { data = [], isLoading } = useQuery<Market[]>({
    queryKey: ['markets', 'briefing'],
    queryFn: () => source.listMarkets(),
  });

  const interests = profile?.interests ?? [];
  const experience = profile?.experience ?? 'active';

  const ranked = recommendFeedDetailed({ markets: data, interests, experience });
  const briefing = ranked
    .filter((r) => r.market.signal === 'opportunity' || r.market.signal === 'watch')
    .slice(0, 12);

  // Hero stats across the whole tracked universe.
  const biggestMover = [...data].sort(
    (a, b) => Math.abs(b.change24h) - Math.abs(a.change24h),
  )[0];
  const platforms = new Set(data.map((m) => m.platform)).size;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={briefing}
        keyExtractor={(r) => r.market.id}
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

            {!isLoading && data.length > 0 && (
              <View style={styles.heroStrip}>
                <HeroStat value={String(data.length)} label="markets tracked" />
                <View style={styles.heroDivider} />
                <HeroStat
                  value={biggestMover ? signedPct(biggestMover.change24h) : '—'}
                  label="biggest move"
                  color={
                    biggestMover && biggestMover.change24h < 0 ? colors.down : colors.up
                  }
                />
                <View style={styles.heroDivider} />
                <HeroStat value={String(platforms)} label={platforms === 1 ? 'platform' : 'platforms'} />
              </View>
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
        renderItem={({ item }: { item: RankedMarket }) => (
          <MarketCard market={item.market} reason={item.reason} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={isLoading ? <SkeletonCards /> : null}
      />

      <HowItWorks visible={showHow} onClose={() => setShowHow(false)} hasInterests={interests.length > 0} />
    </SafeAreaView>
  );
}

function HeroStat({ value, label, color = colors.text }: { value: string; label: string; color?: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={[styles.heroValue, { color }]}>{value}</Text>
      <Text style={styles.heroLabel}>{label}</Text>
    </View>
  );
}

function SkeletonCards() {
  return (
    <View style={{ gap: spacing.md }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeleton}>
          <View style={[styles.bone, { width: '30%' }]} />
          <View style={[styles.bone, { width: '85%', height: 16 }]} />
          <View style={[styles.bone, { width: '40%', height: 24, marginTop: spacing.sm }]} />
        </View>
      ))}
    </View>
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>How your briefing is built</Text>
          <Text style={styles.sheetBody}>
            Signal scans every live market on Polymarket and Kalshi, then ranks them for you by
            blending four factors:
          </Text>
          <Row icon="trending-up" title="Movement" body="Markets that repriced sharply in the last 24h — that's where new information is landing." />
          <Row icon="water" title="Liquidity" body="Real trading volume. Thin markets produce noisy, unreliable prices." />
          <Row icon="help-circle" title="Uncertainty" body="Contested odds near 50% are open questions; markets at 96%+ are already decided and get filtered out." />
          <Row
            icon="person"
            title="Your interests"
            body={
              hasInterests
                ? 'Markets in categories you picked get boosted. Each card shows why it surfaced.'
                : 'Pick interests in onboarding to personalize this feed — right now you see the global ranking.'
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
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.lg, marginTop: spacing.sm },
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
  heroValue: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.4 },
  heroLabel: { fontSize: 10, color: colors.textFaint, marginTop: 2, letterSpacing: 0.3 },
  heroDivider: { width: 1, height: 26, backgroundColor: colors.border },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  sectionLabel: { ...typography.kicker, color: colors.textFaint },
  howBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  howText: { fontSize: 12, color: colors.textFaint, fontWeight: '600' },
  demoBanner: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  demoText: { color: colors.text, ...typography.caption, fontWeight: '600' },
  skeleton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  bone: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceElevated },
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
  sheetCloseText: { color: colors.bg, fontWeight: '700' },
});
