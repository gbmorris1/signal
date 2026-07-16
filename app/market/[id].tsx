import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { colors, radius, spacing, typography } from '@/theme';
import { getMarketSource, getCombinedSource } from '@/services/markets';
import { generateAnalysis } from '@/services/ai';
import { Sparkline } from '@/components/Sparkline';
import { SignalChip } from '@/components/Chip';
import { useWatchlist } from '@/state/watchlist';
import { useEntitlement } from '@/state/entitlement';
import { getAiUsageToday, incrementAiUsage } from '@/state/usage';
import { pct, signedPct, compactUsd } from '@/lib/format';
import type { AIAnalysis, Market, MarketSnapshot } from '@/types';

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

  const { data: market } = useQuery<Market | null>({
    queryKey: ['market', marketId],
    queryFn: () => source.getMarket(marketId),
  });
  const { data: history = [] } = useQuery<MarketSnapshot[]>({
    queryKey: ['history', marketId],
    queryFn: () => source.getHistory(marketId),
  });
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
    // Enforce the free-tier daily analysis limit.
    const used = await getAiUsageToday();
    if (used >= entitlements.dailyAiAnalyses) {
      setGated(true);
      return;
    }
    setLoadingAI(true);
    try {
      const result = await generateAnalysis(market, history);
      await incrementAiUsage();
      setAnalysis(result);
    } finally {
      setLoadingAI(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: market.platform }} />

      <SignalChip signal={market.signal} />
      <Text style={styles.title}>{market.title}</Text>

      <View style={styles.statsRow}>
        <Stat label="probability" value={pct(market.probability)} />
        <Stat label="24h" value={signedPct(market.change24h)} color={up ? colors.up : colors.down} />
        <Stat label="volume" value={compactUsd(market.volume)} />
        <Stat label="AI score" value={String(market.aiScore ?? '—')} color={colors.accent} />
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.cardLabel}>Probability history</Text>
        <Sparkline data={history} width={width - spacing.lg * 4} up={up} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Platform comparison</Text>
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
          <Text style={styles.compareEmpty}>
            No matching market found on other platforms yet.
          </Text>
        )}
      </View>

      <Pressable style={[styles.saveBtn, saved && styles.saveBtnActive]} onPress={() => toggle(market)}>
        <Text style={[styles.saveText, saved && { color: colors.bg }]}>
          {saved ? '★ Saved to watchlist' : '☆ Save to watchlist'}
        </Text>
      </Pressable>

      <Text style={styles.section}>AI Analysis</Text>
      {gated ? (
        <View style={styles.gateCard}>
          <Text style={styles.gateTitle}>Daily AI limit reached</Text>
          <Text style={styles.gateBody}>
            You've used all {entitlements.dailyAiAnalyses} of today's analyses on the{' '}
            {entitlements.tier} plan. Upgrade for more.
          </Text>
          <Pressable style={styles.explainBtn} onPress={() => router.push('/paywall?highlight=pro')}>
            <Text style={styles.explainText}>Upgrade</Text>
          </Pressable>
        </View>
      ) : !analysis ? (
        <Pressable style={styles.explainBtn} onPress={runAnalysis} disabled={loadingAI}>
          <Text style={styles.explainText}>
            {loadingAI ? 'Analyzing…' : 'Explain this move'}
          </Text>
        </Pressable>
      ) : (
        <Analysis analysis={analysis} />
      )}
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
            {analysis.aiProbabilityEstimate != null ? pct(analysis.aiProbabilityEstimate) : '—'}
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

function CompareRow({
  label,
  probability,
  spread,
  highlight = false,
}: {
  label: string;
  probability: number;
  spread?: number;
  highlight?: boolean;
}) {
  const spreadPts = spread != null ? Math.round(spread * 100) : null;
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, highlight && { color: colors.text }, { textTransform: 'capitalize' }]}>
        {label}
        {highlight ? '  (this market)' : ''}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {spreadPts != null && spreadPts !== 0 && (
          <Text style={[styles.metaValue, { color: spreadPts > 0 ? colors.up : colors.down }]}>
            {spreadPts > 0 ? '+' : ''}
            {spreadPts}
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
  statValue: { ...typography.mono, fontSize: 18 },
  statLabel: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  chartCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardLabel: { ...typography.bodyStrong, color: colors.textMuted },
  cardBody: { ...typography.body, color: colors.text, lineHeight: 21 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
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
  explainBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
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
  gateBody: { ...typography.body, color: colors.textMuted, lineHeight: 21, textTransform: 'capitalize' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  metaLabel: { color: colors.textMuted, ...typography.body },
  metaValue: { color: colors.text, ...typography.mono },
  compareEmpty: { ...typography.caption, color: colors.textFaint },
});
