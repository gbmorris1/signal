import { useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { PLANS } from '@/data/subscriptions';
import { useEntitlement } from '@/state/entitlement';
import type { PlanTier } from '@/types';

export default function PaywallScreen() {
  const { tier, purchase, restore } = useEntitlement();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const [busy, setBusy] = useState<PlanTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(t: Exclude<PlanTier, 'free'>) {
    setBusy(t);
    setError(null);
    try {
      await purchase(t);
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
          return (
            <View
              key={p.tier}
              style={[styles.plan, isHighlight && styles.planHighlight]}
            >
              <View style={styles.planHead}>
                <Text style={styles.planName}>{p.name}</Text>
                <Text style={styles.planPrice}>{p.priceLabel}</Text>
              </View>
              {p.features.map((f) => (
                <Text key={f} style={styles.feature}>
                  ✓ {f}
                </Text>
              ))}
              <Pressable
                style={[styles.buy, isCurrent && styles.buyOwned]}
                disabled={isCurrent || busy !== null}
                onPress={() => buy(p.tier as Exclude<PlanTier, 'free'>)}
              >
                <Text style={styles.buyText}>
                  {isCurrent ? 'Current plan' : busy === p.tier ? 'Processing…' : `Choose ${p.name}`}
                </Text>
              </Pressable>
            </View>
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
  buy: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
  buyOwned: { backgroundColor: colors.surfaceElevated },
  buyText: { color: colors.bg, fontWeight: '700' },
  error: { ...typography.caption, color: colors.down, textAlign: 'center' },
  restore: { alignItems: 'center', paddingVertical: spacing.sm },
  restoreText: { color: colors.accent, fontWeight: '600' },
  closeText: { color: colors.textFaint },
});
