import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, radius, spacing, typography, buttonPrimary } from '@/theme';
import { PLANS, FEATURE_DETAILS } from '@/data/subscriptions';
import { useEntitlement } from '@/state/entitlement';
import { track } from '@/lib/analytics';
import type { PlanTier } from '@/types';

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
      // User cancelled or store/offering not configured — stay on the paywall.
      setError(e instanceof Error ? e.message : 'Purchase did not complete.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Signal</Text>
        <Text style={styles.title}>Go deeper on every market</Text>
        <Text style={styles.sub}>
          Unlock AI reports, personalized signals, and alerts. Cancel anytime.
        </Text>

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
              <View style={styles.planHead}>
                <Text style={styles.planName}>{p.name}</Text>
                <Text style={styles.planPrice}>{p.priceLabel}</Text>
              </View>
              {p.features.map((f) => (
                <View key={f} style={styles.featureBlock}>
                  <Text style={styles.feature}>✓ {f}</Text>
                  {isExpanded && FEATURE_DETAILS[f] && (
                    <Text style={styles.featureDetail}>{FEATURE_DETAILS[f]}</Text>
                  )}
                </View>
              ))}
              <Text style={styles.expandHint}>
                {isExpanded ? 'Tap to collapse' : 'Tap to see what each feature includes'}
              </Text>
              <Pressable
                style={[styles.buy, isCurrent && styles.buyOwned]}
                disabled={isCurrent || busy !== null}
                onPress={() => buy(p.tier as Exclude<PlanTier, 'free'>)}
              >
                <Text style={styles.buyText}>
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

        <Pressable style={styles.restore} onPress={() => void restore()}>
          <Text style={styles.restoreText}>Restore purchases</Text>
        </Pressable>
        <Pressable style={styles.restore} onPress={() => router.back()}>
          <Text style={styles.closeText}>Not now</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.md },
  kicker: { ...typography.caption, color: colors.accent, fontWeight: '700', letterSpacing: 1 },
  title: { ...typography.display, color: colors.text, fontSize: 28 },
  sub: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  plan: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    gap: 4,
  },
  planHighlight: { borderColor: colors.accent },
  planHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  planName: { ...typography.heading, color: colors.text },
  planPrice: { ...typography.mono, color: colors.accent },
  feature: { ...typography.caption, color: colors.textMuted, lineHeight: 22 },
  featureBlock: { gap: 2 },
  featureDetail: {
    fontSize: 12,
    color: colors.textFaint,
    lineHeight: 17,
    paddingLeft: spacing.lg,
    paddingBottom: spacing.xs,
  },
  expandHint: { fontSize: 11, color: colors.accent, marginTop: spacing.xs },
  buy: { ...buttonPrimary, marginTop: spacing.md },
  buyOwned: { backgroundColor: colors.surfaceElevated },
  buyText: { color: colors.bg, fontWeight: '700' },
  trialNote: { fontSize: 11, color: colors.textFaint, textAlign: 'center', marginTop: spacing.xs },
  error: { ...typography.caption, color: colors.down, textAlign: 'center' },
  restore: { alignItems: 'center', paddingVertical: spacing.sm },
  restoreText: { color: colors.accent, fontWeight: '600' },
  closeText: { color: colors.textFaint },
});
