import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View, StyleSheet, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { colors, radius, spacing, typography, card, shadows, buttonPrimary } from '@/theme';
import { getMarketSource, getCombinedSource } from '@/services/markets';
import { generateAnalysis, fetchCachedAnalysis, firstSentence } from '@/services/ai';
import { track } from '@/lib/analytics';
import { ProbabilityChart } from '@/components/ProbabilityChart';
import { ScoreExplainer } from '@/components/ScoreExplainer';
import { OutcomeSplit } from '@/components/OutcomeSplit';
import { ProbabilityGauge } from '@/components/ProbabilityGauge';
import { AnimatedNumber, Enter } from '@/components/motion';
import * as Haptics from 'expo-haptics';
import { SignalChip, PlatformBadge } from '@/components/Chip';
import { useWatchlist } from '@/state/watchlist';
import { useEntitlement } from '@/state/entitlement';
import { getAiUsageToday, incrementAiUsage } from '@/state/usage';
import { pct, signedPct, compactUsd, platformUrl } from '@/lib/format';
import type { AIAnalysis, Market, MarketHistory } from '@/types';

export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const marketId = decodeURIComponent(id ?? '');
  const source = useMemo(() => getMarketSource(), []);
  const { width } = useWindowDimensions();
  const { has, toggle } = useWatchlist();
  const { entitlements } = useEntitlement();
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [gated, setGated] = useState(false);
  const [teaser, setTeaser] = useState<string | null>(null);
  const [showScore, setShowScore] = useState(false);

  const { data: market } = useQuery<Market | null>({
    queryKey: ['market', marketId],
    queryFn: () => source.getMarket(marketId),
  });
  const { data: history } = useQuery<MarketHistory>({
    queryKey: ['history', marketId],
    queryFn: () => source.getHistory(marketId),
  });
  const snapshots = history?.snapshots ?? [];
  // Cross-platform comparison (live mode only; [] in mock/demo).
  const { data: comparables = [] } = useQuery<Market[]>({
    queryKey: ['comparables', marketId],
    queryFn: async () => {
      const combined = getCombinedSource();
      const m = await source.getMarket(marketId);
      if (!combined || !m) return [];
      return combined.findComparables(m);
    },
  });

  if (!market) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading market…</Text>
      </View>
    );
  }

  const up = market.change24h >= 0;
  const saved = has(market.id);

  async function runAnalysis() {
    if (!market) return;
    track('explain_click', { market_id: market.id, tier: entitlements.tier });
    // Enforce the daily analysis limit for this tier.
    const used = await getAiUsageToday();
    if (used >= entitlements.dailyAiAnalyses) {
      setGated(true);
      track('gated_impression', { market_id: market.id, tier: entitlements.tier });
      // Teaser comes from the shared cache only — never a fresh model call.
      const cached = await fetchCachedAnalysis(market.id);
      if (cached) setTeaser(firstSentence(cached.summary));
      return;
    }
    setLoadingAI(true);
    try {
      // Depth follows the tier: free=shallow teaser, pro=standard, trader=deep.
      const result = await generateAnalysis(market, snapshots, entitlements.aiDepth);
      await incrementAiUsage();
      setAnalysis(result);
      track('analysis_viewed', {
        market_id: market.id,
        tier: entitlements.tier,
        depth: entitlements.aiDepth,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setLoadingAI(false);
    }
  }

  function onToggleSave() {
    if (!market) return;
    void Haptics.impactAsync(
      saved ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
    );
    toggle(market);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: market.platform.charAt(0).toUpperCase() + market.platform.slice(1),
          headerBackTitle: 'Back',
        }}
      />

      <View style={styles.badgeRow}>
        <PlatformBadge platform={market.platform} size="md" />
        <SignalChip signal={market.signal} />
      </View>
      <Text style={styles.title}>{market.title}</Text>

      <View style={[styles.card, styles.headlineCard, up ? shadows.glowUp : shadows.glowDown]}>
        <ProbabilityGauge probability={market.probability} up={up} />
        <View style={{ flex: 1 }}>
          <OutcomeSplit market={market} size="lg" />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View>
          <AnimatedNumber
            value={market.probability * 100}
            format={(v) => `${Math.round(v)}%`}
            style={[styles.statValue, { color: colors.text }]}
          />
          <Text style={styles.statLabel}>{market.outcomeLabels[0].toLowerCase()}</Text>
        </View>
        <Stat label="24h" value={signedPct(market.change24h)} color={up ? colors.up : colors.down} />
        <Stat label="volume" value={compactUsd(market.volume)} />
        <Pressable onPress={() => setShowScore(true)} hitSlop={8}>
          <Stat
            label="signal score ⓘ"
            value={String(market.aiScore ?? '–')}
            color={colors.accent}
          />
        </Pressable>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.cardLabel}>Probability · past week</Text>
          {history?.synthetic ? (
            <Text style={styles.syntheticTag}>SIMULATED PREVIEW</Text>
          ) : (
            <Text style={styles.scrubHint}>touch to inspect</Text>
          )}
        </View>
        <ProbabilityChart data={snapshots} width={width - spacing.lg * 4} up={up} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Platform availability</Text>
        <CompareRow label={market.platform} probability={market.probability} highlight />
        {comparables.length > 0 ? (
          comparables.map((c: Market) => (
            <Pressable key={c.id} onPress={() => router.push(`/market/${encodeURIComponent(c.id)}`)}>
              <CompareRow
                label={c.platform}
                probability={c.probability}
                spread={c.probability - market.probability}
              />
            </Pressable>
          ))
        ) : (
          <View style={styles.exclusiveRow}>
            <Text style={styles.compareEmpty}>
              Only listed on {market.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}, with no
              equivalent market on {market.platform === 'polymarket' ? 'Kalshi' : 'Polymarket'}.
            </Text>
          </View>
        )}
        <Text style={styles.compareFoot}>
          Most questions trade on a single platform. When both list the same question, the spread
          between their odds is shown.
        </Text>
        <Pressable
          style={styles.externalBtn}
          onPress={() => {
            track('external_open', { market_id: market.id, platform: market.platform });
            void Linking.openURL(platformUrl(market));
          }}
        >
          <Text style={styles.externalText}>
            Open on {market.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
          </Text>
          <Ionicons name="open-outline" size={14} color={platformColor(market.platform)} />
        </Pressable>
      </View>

      <Pressable style={[styles.saveBtn, saved && styles.saveBtnActive]} onPress={onToggleSave}>
        <Text style={[styles.saveText, saved && { color: colors.bg }]}>
          {saved ? '★ Saved to watchlist' : '☆ Save to watchlist'}
        </Text>
      </Pressable>

      <Text style={styles.section}>AI Analysis</Text>
      <Text style={styles.aiDisclaimer}>
        Model reasoning from price action and market data, not a live news feed. Not financial
        advice.
      </Text>
      {gated ? (
        <View style={styles.gateCard}>
          {teaser && (
            <View style={styles.teaserWrap}>
              <Text style={styles.teaserText}>{teaser}</Text>
              {/* obscured continuation implies the rest of the report */}
              <Text style={styles.teaserBlur} numberOfLines={2}>
                The full report covers the bull and bear cases, why the market moved, upcoming
                catalysts with timing, and the model's own probability estimate…
              </Text>
              <View style={styles.teaserFade} />
            </View>
          )}
          <Text style={styles.gateTitle}>
            {teaser ? 'Unlock the full report' : 'Daily AI limit reached'}
          </Text>
          <Text style={styles.gateBody}>
            You've used all {entitlements.dailyAiAnalyses} of today's analyses on the{' '}
            {entitlements.tier} plan.
          </Text>
          <Pressable
            style={styles.explainBtn}
            onPress={() => {
              track('paywall_view', { source: 'gate', market_id: market.id });
              router.push('/paywall?highlight=pro');
            }}
          >
            <Text style={styles.explainText}>Try Pro free for 3 days</Text>
          </Pressable>
        </View>
      ) : !analysis ? (
        <Pressable style={styles.explainBtn} onPress={runAnalysis} disabled={loadingAI}>
          <Text style={styles.explainText}>
            {loadingAI ? 'Analyzing…' : 'Explain this move'}
          </Text>
        </Pressable>
      ) : (
        <Enter>
          <Analysis analysis={analysis} />
        </Enter>
      )}

      <ScoreExplainer market={market} visible={showScore} onClose={() => setShowScore(false)} />
    </ScrollView>
  );
}

function Analysis({ analysis }: { analysis: AIAnalysis }) {
  return (
    <View style={{ gap: spacing.md }}>
      <Block title="Summary" body={analysis.summary} />
      <Block title="Why it moved" body={analysis.whyChanged} />
      <Block title="Bull case" body={analysis.bullCase} accent={colors.up} />
      <Block title="Bear case" body={analysis.bearCase} accent={colors.down} />
      <ListBlock title="Catalysts" items={analysis.catalysts} />
      <ListBlock title="Risk factors" items={analysis.riskFactors} />
      <View style={styles.card}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>AI probability estimate</Text>
          <Text style={styles.metaValue}>
            {analysis.aiProbabilityEstimate != null ? pct(analysis.aiProbabilityEstimate) : '–'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Confidence</Text>
          <Text style={[styles.metaValue, { textTransform: 'capitalize' }]}>{analysis.confidence}</Text>
        </View>
      </View>
    </View>
  );
}

function platformColor(p: 'polymarket' | 'kalshi'): string {
  return p === 'polymarket' ? colors.polymarket : colors.kalshi;
}

function CompareRow({
  label,
  probability,
  spread,
  highlight = false,
}: {
  label: 'polymarket' | 'kalshi';
  probability: number;
  spread?: number;
  highlight?: boolean;
}) {
  const spreadPts = spread != null ? Math.round(spread * 100) : null;
  return (
    <View style={styles.metaRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <PlatformBadge platform={label} />
        {highlight && <Text style={styles.thisMarket}>this market</Text>}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {spreadPts != null && spreadPts !== 0 && (
          <Text style={[styles.metaValue, { color: spreadPts > 0 ? colors.up : colors.down }]}>
            {spreadPts > 0 ? '+' : ''}
            {spreadPts} pts
          </Text>
        )}
        <Text style={styles.metaValue}>{pct(probability)}</Text>
      </View>
    </View>
  );
}

function Stat({ label, value, color = colors.text }: { label: string; value: string; color?: string }) {
  return (
    <View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Block({ title, body, accent }: { title: string; body: string; accent?: string }) {
  return (
    <View style={styles.card}>
      <Text style={[styles.cardLabel, accent ? { color: accent } : null]}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
    </View>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{title}</Text>
      {items.map((it) => (
        <Text key={it} style={styles.cardBody}>
          • {it}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  muted: { color: colors.textMuted },
  title: { ...typography.title, color: colors.text, marginTop: spacing.xs },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.sm },
  statValue: { ...typography.monoLarge },
  statLabel: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  chartCard: {
    ...card,
    gap: spacing.sm,
  },
  headlineCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  syntheticTag: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.warn,
  },
  scrubHint: { fontSize: 10, color: colors.textFaint, fontStyle: 'italic' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exclusiveRow: { paddingVertical: spacing.xs },
  compareFoot: { fontSize: 11, color: colors.textFaint, lineHeight: 16, marginTop: spacing.xs },
  externalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  externalText: { fontSize: 13, fontWeight: '700', color: colors.text },
  aiDisclaimer: { ...typography.caption, color: colors.textFaint, marginTop: -spacing.sm },
  cardLabel: { ...typography.bodyStrong, color: colors.textMuted },
  cardBody: { ...typography.body, color: colors.text, lineHeight: 21 },
  card: {
    ...card,
    gap: spacing.xs,
  },
  saveBtn: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveBtnActive: { backgroundColor: colors.accent },
  saveText: { color: colors.accent, fontWeight: '600' },
  section: { ...typography.heading, color: colors.text, marginTop: spacing.sm },
  explainBtn: { ...buttonPrimary },
  explainText: { color: colors.bg, fontWeight: '700' },
  gateCard: {
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  gateTitle: { ...typography.heading, color: colors.text },
  teaserWrap: { position: 'relative', gap: spacing.xs, marginBottom: spacing.xs },
  teaserText: { ...typography.body, color: colors.text, lineHeight: 21 },
  teaserBlur: { ...typography.body, color: colors.textFaint, lineHeight: 21, opacity: 0.45 },
  teaserFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 34,
    backgroundColor: 'transparent',
    borderBottomWidth: 34,
    borderBottomColor: colors.surface,
    opacity: 0.85,
  },
  gateBody: { ...typography.body, color: colors.textMuted, lineHeight: 21, textTransform: 'capitalize' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  metaLabel: { color: colors.textMuted, ...typography.body },
  metaValue: { color: colors.text, ...typography.mono },
  compareEmpty: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  thisMarket: { fontSize: 11, color: colors.textFaint, fontStyle: 'italic' },
});
