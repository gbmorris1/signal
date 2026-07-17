import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, buttonPrimary, card, shadows } from '@/theme';
import { PLANS, FEATURE_DETAILS } from '@/data/subscriptions';
import { useEntitlement } from '@/state/entitlement';
import { track } from '@/lib/analytics';
import type { PlanTier } from '@/types';

const PLAN_TAGLINE: Record<string, string> = {
  pro: 'For daily market watchers',
  trader: 'For serious researchers',
};

export default function PaywallScreen() {
  const { tier, purchase, restore } = useEntitlement();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const [busy, setBusy] = useState<PlanTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<PlanTier | null>(null);

  useEffect(() => {
    track('paywall_view', { highlight: highlight ?? 'none' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buy(t: Exclude<PlanTier, 'free'>) {
    setBusy(t);
    setError(null);
    track('purchase_start', { plan: t });
    try {
      await purchase(t);
      // The 3-day trial itself is configured on the RevenueCat offering; a
      // fresh purchase of a trial-bearing package starts in trial.
      track('trial_start', { plan: t });
      track('purchase_complete', { plan: t });
      router.back();
    } catch (e) {
      // User cancelled or store/offering not configured. Stay on the paywall.
      setError(e instanceof Error ? e.message : 'Purchase did not complete.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.closeX} hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="close" size={20} color={colors.textFaint} />
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.mark}>
            <Ionicons name="sparkles" size={26} color={colors.accent} />
          </View>
          <Text style={styles.title}>Go deeper on every market</Text>
          <Text style={styles.sub}>
            Full AI reports, a feed built around you, and alerts the moment your markets move.
          </Text>
        </View>

        {PLANS.filter((p) => p.tier !== 'free').map((p) => {
          const isCurrent = tier === p.tier;
          const isHighlight = highlight === p.tier || (!highlight && p.tier === 'pro');
          const isExpanded = expanded === p.tier;
          return (
            <Pressable
              key={p.tier}
              style={[styles.plan, isHighlight && styles.planHighlight]}
              onPress={() => {
                if (!isExpanded) track('plan_select', { plan: p.tier });
                setExpanded(isExpanded ? null : p.tier);
              }}
            >
              {isHighlight && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>MOST POPULAR</Text>
                </View>
              )}
              <View style={styles.planHead}>
                <View>
                  <Text style={styles.planName}>{p.name}</Text>
                  <Text style={styles.planTagline}>{PLAN_TAGLINE[p.tier] ?? ''}</Text>
                </View>
                <View style={styles.priceBlock}>
                  <Text style={styles.planPrice}>{p.priceLabel.replace('/mo', '')}</Text>
                  <Text style={styles.perMonth}>per month</Text>
                </View>
              </View>

              <View style={styles.featureList}>
                {p.features.map((f) => (
                  <View key={f} style={styles.featureBlock}>
                    <View style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={15} color={colors.up} />
                      <Text style={styles.feature}>{f}</Text>
                    </View>
                    {isExpanded && FEATURE_DETAILS[f] && (
                      <Text style={styles.featureDetail}>{FEATURE_DETAILS[f]}</Text>
                    )}
                  </View>
                ))}
              </View>

              <Text style={styles.expandHint}>
                {isExpanded ? 'Hide details' : 'See what each feature includes'}
              </Text>

              <Pressable
                style={[styles.buy, isCurrent && styles.buyOwned]}
                disabled={isCurrent || busy !== null}
                onPress={() => buy(p.tier as Exclude<PlanTier, 'free'>)}
              >
                <Text style={[styles.buyText, isCurrent && { color: colors.textMuted }]}>
                  {isCurrent
                    ? 'Current plan'
                    : busy === p.tier
                      ? 'Processing…'
                      : `Try ${p.name} free for 3 days`}
                </Text>
              </Pressable>
              {!isCurrent && (
                <Text style={styles.trialNote}>
                  Then {p.priceLabel}. Cancel anytime before the trial ends.
                </Text>
              )}
            </Pressable>
          );
        })}

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.footRow}>
          <Pressable style={styles.foot} onPress={() => void restore()}>
            <Text style={styles.footText}>Restore purchases</Text>
          </Pressable>
          <Text style={styles.footDot}>·</Text>
          <Pressable style={styles.foot} onPress={() => router.back()}>
            <Text style={styles.footTextMuted}>Not now</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingTop: spacing.lg, gap: spacing.lg },
  closeX: { alignSelf: 'flex-end' },
  hero: { alignItems: 'center', marginBottom: spacing.sm },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.glowAccent,
  },
  title: { ...typography.title, color: colors.text, fontSize: 26, textAlign: 'center' },
  sub: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 21,
    paddingHorizontal: spacing.md,
  },
  plan: { ...card, gap: spacing.md },
  planHighlight: { borderColor: colors.accent, ...shadows.glowAccent },
  popularBadge: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -52,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  popularText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: colors.bg },
  planHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planName: { ...typography.title, color: colors.text },
  planTagline: { ...typography.caption, color: colors.textFaint, marginTop: 2 },
  priceBlock: { alignItems: 'flex-end' },
  planPrice: { ...typography.monoLarge, color: colors.text },
  perMonth: { ...typography.caption, color: colors.textFaint },
  featureList: { gap: spacing.sm },
  featureBlock: { gap: 2 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  feature: { ...typography.body, color: colors.textMuted },
  featureDetail: {
    fontSize: 12,
    color: colors.textFaint,
    lineHeight: 17,
    paddingLeft: 23,
    paddingBottom: spacing.xs,
  },
  expandHint: { fontSize: 11, color: colors.accent, fontWeight: '700' },
  buy: { ...buttonPrimary },
  buyOwned: { backgroundColor: colors.surfaceElevated, shadowOpacity: 0, borderTopWidth: 0 },
  buyText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
  trialNote: { fontSize: 11, color: colors.textFaint, textAlign: 'center' },
  error: { ...typography.caption, color: colors.down, textAlign: 'center' },
  footRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  foot: { paddingVertical: spacing.sm },
  footText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  footDot: { color: colors.textFaint },
  footTextMuted: { color: colors.textFaint, fontSize: 13 },
});
