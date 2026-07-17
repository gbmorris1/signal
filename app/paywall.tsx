import { useEffect, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, buttonPrimary, shadows } from '@/theme';
import { PLANS, FEATURE_DETAILS } from '@/data/subscriptions';
import { useEntitlement } from '@/state/entitlement';
import { track } from '@/lib/analytics';
import type { PlanTier } from '@/types';

const PLAN_TAGLINE: Record<string, string> = {
  pro: 'Daily market watchers',
  trader: 'Serious researchers',
};

export default function PaywallScreen() {
  const { tier, purchase, restore } = useEntitlement();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const [selected, setSelected] = useState<Exclude<PlanTier, 'free'>>(
    highlight === 'trader' ? 'trader' : 'pro',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track('paywall_view', { highlight: highlight ?? 'none' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = PLANS.find((p) => p.tier === selected)!;
  const isCurrent = tier === selected;

  async function buy() {
    setBusy(true);
    setError(null);
    track('purchase_start', { plan: selected });
    try {
      await purchase(selected);
      // The 3-day trial itself is configured on the RevenueCat offering; a
      // fresh purchase of a trial-bearing package starts in trial.
      track('trial_start', { plan: selected });
      track('purchase_complete', { plan: selected });
      router.back();
    } catch (e) {
      // User cancelled or store/offering not configured. Stay on the paywall.
      setError(e instanceof Error ? e.message : 'Purchase did not complete.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Pressable style={styles.closeX} hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="close" size={20} color={colors.textFaint} />
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.mark}>
            <Ionicons name="sparkles" size={24} color={colors.accent} />
          </View>
          <Text style={styles.title}>Go deeper on every market</Text>
        </View>

        {/* Plan selector: two compact cards, one always selected. */}
        <View style={styles.planRow}>
          {PLANS.filter((p) => p.tier !== 'free').map((p) => {
            const active = selected === p.tier;
            const popular = p.tier === 'pro';
            return (
              <Pressable
                key={p.tier}
                style={[styles.planCard, active && styles.planCardActive]}
                onPress={() => {
                  if (!active) {
                    track('plan_select', { plan: p.tier });
                    setSelected(p.tier as Exclude<PlanTier, 'free'>);
                  }
                }}
              >
                {popular && (
                  <View style={[styles.popularBadge, !active && styles.popularBadgeMuted]}>
                    <Text style={styles.popularText}>POPULAR</Text>
                  </View>
                )}
                <Text style={[styles.planName, active && { color: colors.text }]}>{p.name}</Text>
                <Text style={styles.planPrice}>{p.priceLabel.replace('/mo', '')}</Text>
                <Text style={styles.perMonth}>per month</Text>
                <Text style={styles.planTagline}>{PLAN_TAGLINE[p.tier]}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Feature detail for the selected plan: fixed area, no scrolling. */}
        <View style={styles.features}>
          {plan.features.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.up} />
              <View style={{ flex: 1 }}>
                <Text style={styles.feature}>{f}</Text>
                {FEATURE_DETAILS[f] && <Text style={styles.featureDetail}>{FEATURE_DETAILS[f]}</Text>}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable style={styles.buy} disabled={isCurrent || busy} onPress={buy}>
            <Text style={styles.buyText}>
              {isCurrent ? 'Current plan' : busy ? 'Processing…' : `Try ${plan.name} free for 3 days`}
            </Text>
          </Pressable>
          {!isCurrent && (
            <Text style={styles.trialNote}>
              Then {plan.priceLabel}. Cancel anytime before the trial ends.
            </Text>
          )}
          <View style={styles.footRow}>
            <Pressable hitSlop={8} onPress={() => void restore()}>
              <Text style={styles.footText}>Restore purchases</Text>
            </Pressable>
            <Text style={styles.footDot}>·</Text>
            <Pressable hitSlop={8} onPress={() => router.back()}>
              <Text style={styles.footTextMuted}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: spacing.xl, paddingTop: spacing.md },
  closeX: { alignSelf: 'flex-end' },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  mark: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.glowAccent,
  },
  title: { ...typography.title, color: colors.text, fontSize: 24, textAlign: 'center' },
  planRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  planCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 2,
  },
  planCardActive: { borderColor: colors.accent, ...shadows.glowAccent },
  popularBadge: {
    position: 'absolute',
    top: -9,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  popularBadgeMuted: { backgroundColor: colors.surfaceElevated },
  popularText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: colors.bg },
  planName: { ...typography.heading, color: colors.textMuted, marginTop: spacing.xs },
  planPrice: { ...typography.monoLarge, color: colors.text, fontSize: 24 },
  perMonth: { fontSize: 11, color: colors.textFaint },
  planTagline: { fontSize: 11, color: colors.textFaint, marginTop: spacing.xs, textAlign: 'center' },
  features: { flex: 1, gap: spacing.md },
  featureRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  feature: { ...typography.bodyStrong, color: colors.text, fontSize: 14 },
  featureDetail: { fontSize: 12, color: colors.textFaint, lineHeight: 16, marginTop: 1 },
  footer: { gap: spacing.sm },
  error: { ...typography.caption, color: colors.down, textAlign: 'center' },
  buy: { ...buttonPrimary },
  buyText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
  trialNote: { fontSize: 11, color: colors.textFaint, textAlign: 'center' },
  footRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  footText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  footDot: { color: colors.textFaint },
  footTextMuted: { color: colors.textFaint, fontSize: 13 },
});
