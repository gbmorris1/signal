import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
  useWindowDimensions,
  type TextStyle,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing, typography, card, shadows, buttonPrimary } from '@/theme';
import { getMarketSource, getCombinedSource } from '@/services/markets';
import { generateAnalysis, isGated } from '@/services/ai';
import { track } from '@/lib/analytics';
import { ProbabilityChart } from '@/components/ProbabilityChart';
import { ScoreExplainer } from '@/components/ScoreExplainer';
import { OutcomeSplit } from '@/components/OutcomeSplit';
import { ProbabilityGauge } from '@/components/ProbabilityGauge';
import { ExternalLinkSheet } from '@/components/ExternalLinkSheet';
import { Bone } from '@/components/Skeleton';
import { Enter } from '@/components/motion';
import { SignalChip, PlatformBadge } from '@/components/Chip';
import { useWatchlist } from '@/state/watchlist';
import { useEntitlement } from '@/state/entitlement';
import { useAuth } from '@/state/auth';
import { pct, signedPct, compactUsd, platformUrl } from '@/lib/format';
import type { AIAnalysis, Confidence, Market, MarketHistory } from '@/types';

const CONFIDENCE_COLOR: Record<Confidence, string> = {
  low: colors.warn,
  medium: colors.accent,
  high: colors.up,
};

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

function platformColor(p: 'polymarket' | 'kalshi'): string {
  return p === 'polymarket' ? colors.polymarket : colors.kalshi;
}

export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const marketId = decodeURIComponent(id ?? '');
  const source = useMemo(() => getMarketSource(), []);
  const { width } = useWindowDimensions();
  const { has, toggle } = useWatchlist();
  const { entitlements } = useEntitlement();
  const { demo } = useAuth();
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [gated, setGated] = useState(false);
  const [teaser, setTeaser] = useState<string | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [showExternal, setShowExternal] = useState(false);
  const [highlightedSource, setHighlightedSource] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const EXT_SKIP_KEY = 'oddiq.skipExternalWarning.v1';

  // Sources card is always the last thing on the page, so scrolling to the
  // end reliably surfaces it without a fragile measureLayout call.
  function onCite(n: number) {
    void Haptics.selectionAsync();
    setHighlightedSource(n);
    scrollRef.current?.scrollToEnd({ animated: true });
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedSource(null), 1800);
  }

  const { data: market } = useQuery<Market | null>({
    queryKey: ['market', marketId],
    queryFn: () => source.getMarket(marketId),
  });
  const { data: history } = useQuery<MarketHistory>({
    queryKey: ['history', marketId],
    queryFn: () => source.getHistory(marketId),
  });
  const snapshots = history?.snapshots ?? [];

  // Funnel: market viewed (first view per user is MIN(created_at) in SQL).
  useEffect(() => {
    if (marketId) track('market_viewed', { market_id: marketId });
  }, [marketId]);

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
      <View style={styles.loading}>
        <Bone style={{ width: '55%', height: 14 }} />
        <Bone style={{ width: '90%', height: 22 }} />
        <Bone style={{ width: '100%', height: 120, borderRadius: radius.lg }} />
        <Bone style={{ width: '100%', height: 200, borderRadius: radius.lg }} />
      </View>
    );
  }

  const up = market.change24h >= 0;
  const flat = Math.round(market.change24h * 100) === 0;
  const saved = has(market.id);

  async function runAnalysis() {
    if (!market) return;
    if (demo) {
      track('demo_ai_blocked', { market_id: market.id });
      router.push('/auth');
      return;
    }
    track('explain_click', { market_id: market.id, tier: entitlements.tier });
    setLoadingAI(true);
    try {
      // Depth follows the tier; the SERVER enforces the real tier + daily quota
      // and returns a gated teaser when the user is over their limit.
      const result = await generateAnalysis(market, snapshots, entitlements.aiDepth);
      if (isGated(result)) {
        setGated(true);
        setTeaser(result.teaser);
        track('gated_impression', { market_id: market.id, tier: entitlements.tier });
      } else {
        setAnalysis(result);
        track('analysis_viewed', {
          market_id: market.id,
          tier: entitlements.tier,
          depth: entitlements.aiDepth,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      setLoadingAI(false);
    }
  }

  function onToggleSave() {
    if (!market) return;
    if (demo) {
      track('demo_watchlist_blocked', { market_id: market.id });
      router.push('/auth');
      return;
    }
    if (!saved) {
      const ok = toggle(market);
      if (!ok) {
        track('watchlist_limit_hit', { market_id: market.id, tier: entitlements.tier });
        router.push('/paywall?highlight=pro');
        return;
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      track('watchlist_add', { market_id: market.id });
    } else {
      toggle(market);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  function leaveToPlatform() {
    if (!market) return;
    track('external_open', { market_id: market.id, platform: market.platform });
    void Linking.openURL(platformUrl(market));
  }

  async function openOnPlatform() {
    if (!market) return;
    // Respect a saved "don't show again" choice; otherwise show the sheet.
    const skip = await AsyncStorage.getItem(EXT_SKIP_KEY);
    if (skip === '1') leaveToPlatform();
    else setShowExternal(true);
  }

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen
        options={{
          title: market.platform.charAt(0).toUpperCase() + market.platform.slice(1),
          headerBackTitle: 'Back',
        }}
      />

      {/* ── Headline ── */}
      <Enter>
        <View style={styles.badgeRow}>
          <PlatformBadge platform={market.platform} size="md" />
          <SignalChip signal={market.signal} />
          <View style={{ flex: 1 }} />
          <Pressable hitSlop={10} onPress={onToggleSave} style={[styles.saveStar, saved && styles.saveStarOn]}>
            <Ionicons name={saved ? 'star' : 'star-outline'} size={17} color={saved ? colors.bg : colors.textMuted} />
          </Pressable>
        </View>
        <Text style={styles.title}>{market.title}</Text>

        <View style={[styles.card, styles.headlineCard, up ? shadows.glowUp : shadows.glowDown]}>
          <ProbabilityGauge probability={market.probability} up={up} />
          <View style={{ flex: 1, gap: spacing.md }}>
            <OutcomeSplit market={market} size="lg" />
            {!flat && (
              <Text style={[styles.moveLine, { color: up ? colors.up : colors.down }]}>
                {signedPct(market.change24h)} in the last 24h
              </Text>
            )}
          </View>
        </View>

        {/* ── Stat strip ── */}
        <View style={styles.statStrip}>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: flat ? colors.textMuted : up ? colors.up : colors.down }]}>
              {signedPct(market.change24h)}
            </Text>
            <Text style={styles.statLabel}>24h move</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{compactUsd(market.volume)}</Text>
            <Text style={styles.statLabel}>volume</Text>
          </View>
          <View style={styles.statDivider} />
          <Pressable style={styles.statCell} hitSlop={8} onPress={() => setShowScore(true)}>
            <Text style={[styles.statValue, { color: colors.accent }]}>{market.aiScore ?? '–'}</Text>
            <View style={styles.scoreLabelRow}>
              <Text style={styles.statLabel}>signal score</Text>
              <Ionicons name="information-circle-outline" size={11} color={colors.textFaint} />
            </View>
          </Pressable>
        </View>
      </Enter>

      {/* ── Chart ── */}
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

      {/* ── About ── */}
      {market.description && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>About this market</Text>
          <Text style={styles.aboutText} numberOfLines={aboutExpanded ? undefined : 3}>
            {market.description}
          </Text>
          {market.description.length > 140 && (
            <Pressable hitSlop={8} onPress={() => setAboutExpanded((v) => !v)}>
              <Text style={styles.aboutMore}>{aboutExpanded ? 'Show less' : 'Read more'}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* ── Availability ── */}
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
          <Text style={styles.compareEmpty}>
            Only listed on {market.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}, with no
            equivalent market on {market.platform === 'polymarket' ? 'Kalshi' : 'Polymarket'}.
          </Text>
        )}
        <Pressable
          style={[
            styles.externalBtn,
            {
              backgroundColor:
                market.platform === 'polymarket' ? colors.polymarketDim : colors.kalshiDim,
              borderColor: platformColor(market.platform),
            },
          ]}
          onPress={openOnPlatform}
        >
          <View style={[styles.brandGlyph, { backgroundColor: platformColor(market.platform) }]}>
            <Text style={styles.brandGlyphText}>{market.platform === 'polymarket' ? 'P' : 'K'}</Text>
          </View>
          <Text style={[styles.externalText, { color: platformColor(market.platform) }]}>
            Open on {market.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
          </Text>
          <Ionicons name="open-outline" size={14} color={platformColor(market.platform)} />
        </Pressable>
      </View>

      {/* ── AI Analysis ── */}
      <View style={styles.aiHeader}>
        <Text style={styles.sectionKicker}>AI ANALYSIS</Text>
        <Text style={styles.aiDisclaimer}>Model view from market data. Not financial advice.</Text>
      </View>

      {demo ? (
        <View style={styles.gateCard}>
          <Text style={styles.gateTitle}>Create a free account</Text>
          <Text style={styles.gateBody}>
            Sign up to run AI analysis and save markets to your watchlist.
          </Text>
          <Pressable style={styles.explainBtn} onPress={() => router.push('/auth')}>
            <Text style={styles.explainText}>Create account</Text>
          </Pressable>
        </View>
      ) : gated ? (
        <View style={styles.gateCard}>
          {teaser && (
            <View style={styles.teaserWrap}>
              <Text style={styles.teaserText}>{teaser}</Text>
              <Text style={styles.teaserBlur} numberOfLines={2}>
                The full report covers the bull and bear cases, why the market moved, upcoming
                catalysts with timing, and the model's own probability estimate…
              </Text>
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
      ) : loadingAI ? (
        <AnalysisSkeleton tier={entitlements.tier} />
      ) : !analysis ? (
        <Pressable style={styles.explainBtn} onPress={runAnalysis}>
          <Ionicons name="sparkles" size={15} color={colors.bg} />
          <Text style={styles.explainText}>Explain this move</Text>
        </Pressable>
      ) : (
        <Enter>
          <Analysis
            analysis={analysis}
            onCite={onCite}
            highlightedSource={highlightedSource}
          />
        </Enter>
      )}

      <ScoreExplainer market={market} visible={showScore} onClose={() => setShowScore(false)} />
      <ExternalLinkSheet
        platform={market.platform}
        visible={showExternal}
        onCancel={() => setShowExternal(false)}
        onContinue={async (dontAsk) => {
          if (dontAsk) await AsyncStorage.setItem(EXT_SKIP_KEY, '1');
          setShowExternal(false);
          leaveToPlatform();
        }}
      />
    </ScrollView>
  );
}

/** Animated placeholder while the model runs — reads as "working", not frozen. */
function AnalysisSkeleton({ tier }: { tier: string }) {
  const pulse = useMemo(() => new Animated.Value(0.4), []);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const steps =
    tier === 'trader'
      ? 'Reading ~8 sources and pricing the edge…'
      : tier === 'pro'
        ? 'Reading the latest news and forming a view…'
        : 'Analyzing the move…';

  return (
    <View style={{ gap: spacing.md }}>
      <View style={[styles.card, styles.edgeCard]}>
        <View style={styles.edgeHead}>
          <Ionicons name="flash" size={15} color={colors.accent} />
          <Text style={styles.edgeLabel}>ODDIQ'S EDGE</Text>
        </View>
        <Animated.View style={[styles.bone, { width: '95%', opacity: pulse }]} />
        <Animated.View style={[styles.bone, { width: '88%', opacity: pulse }]} />
        <Animated.View style={[styles.bone, { width: '60%', opacity: pulse }]} />
      </View>
      <Text style={styles.skeletonStatus}>{steps}</Text>
    </View>
  );
}

function Analysis({
  analysis,
  onCite,
  highlightedSource,
}: {
  analysis: AIAnalysis;
  onCite: (n: number) => void;
  highlightedSource: number | null;
}) {
  const confColor = CONFIDENCE_COLOR[analysis.confidence] ?? colors.accent;
  return (
    <View style={{ gap: spacing.md }}>
      {analysis.edge ? (
        <View style={[styles.card, styles.edgeCard, shadows.glowAccent]}>
          <View style={styles.edgeHead}>
            <Ionicons name="flash" size={15} color={colors.accent} />
            <Text style={styles.edgeLabel}>ODDIQ'S EDGE</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.freshness}>Updated {timeAgo(analysis.createdAt)}</Text>
          </View>
          <CitedText text={analysis.edge} style={styles.edgeBody} onCite={onCite} />
        </View>
      ) : null}
      <Block title="Summary" body={analysis.summary} onCite={onCite} />
      <Block title="Why it moved" body={analysis.whyChanged} onCite={onCite} />
      <Block title="Bull case" body={analysis.bullCase} accent={colors.up} onCite={onCite} />
      <Block title="Bear case" body={analysis.bearCase} accent={colors.down} onCite={onCite} />
      <ListBlock title="Catalysts to watch" items={analysis.catalysts} icon="calendar-outline" />
      <ListBlock title="Risk factors" items={analysis.riskFactors} icon="warning-outline" />
      {analysis.sources.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Sources</Text>
          {analysis.sources.map((s, i) => (
            <Pressable
              key={s.url + i}
              style={[styles.sourceRow, highlightedSource === i + 1 && styles.sourceRowActive]}
              onPress={() => {
                track('external_open', { kind: 'source', url: s.url });
                if (s.url) void Linking.openURL(s.url);
              }}
              accessibilityRole="link"
              accessibilityLabel={`Source ${i + 1}: ${s.title || s.url}`}
            >
              <Text style={styles.sourceIndex}>[{i + 1}]</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceTitle} numberOfLines={2}>
                  {s.title || s.url}
                </Text>
                {s.date && <Text style={styles.sourceDate}>{s.date}</Text>}
              </View>
              <Ionicons name="open-outline" size={13} color={colors.textFaint} />
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.card}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Model's probability estimate</Text>
          <Text style={styles.metaValue}>
            {analysis.aiProbabilityEstimate != null ? pct(analysis.aiProbabilityEstimate) : '–'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Confidence</Text>
          <View style={[styles.confChip, { borderColor: confColor }]}>
            <View style={[styles.confDot, { backgroundColor: confColor }]} />
            <Text style={[styles.confText, { color: confColor }]}>
              {analysis.confidence.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function Block({
  title,
  body,
  accent,
  onCite,
}: {
  title: string;
  body: string;
  accent?: string;
  onCite: (n: number) => void;
}) {
  return (
    <View style={[styles.card, accent ? { borderLeftWidth: 3, borderLeftColor: accent } : null]}>
      <Text style={[styles.cardLabel, accent ? { color: accent } : null]}>{title}</Text>
      <CitedText text={body} style={styles.cardBody} onCite={onCite} />
    </View>
  );
}

/** Renders body text with inline [n] citations as tappable chips that jump to Sources. */
function CitedText({
  text,
  style,
  onCite,
}: {
  text: string;
  style: TextStyle;
  onCite: (n: number) => void;
}) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        const m = /^\[(\d+)\]$/.exec(part);
        if (!m) return part;
        const n = parseInt(m[1], 10);
        return (
          <Text key={i} style={styles.citation} onPress={() => onCite(n)} suppressHighlighting>
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

function ListBlock({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: keyof typeof Ionicons.glyphMap;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{title}</Text>
      {items.map((it) => (
        <View key={it} style={styles.listRow}>
          <Ionicons name={icon} size={13} color={colors.textFaint} style={{ marginTop: 3 }} />
          <Text style={[styles.cardBody, { flex: 1 }]}>{it}</Text>
        </View>
      ))}
    </View>
  );
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

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  loading: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.md },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  saveStar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveStarOn: { backgroundColor: colors.warn, borderColor: colors.warn },
  title: { ...typography.title, color: colors.text, lineHeight: 27, marginTop: spacing.md },
  card: { ...card, gap: spacing.sm },
  headlineCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md },
  moveLine: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
  statValue: { ...typography.monoLarge, fontSize: 17, color: colors.text },
  statLabel: { fontSize: 10, color: colors.textFaint, letterSpacing: 0.3 },
  scoreLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  chartCard: { ...card, gap: spacing.sm },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { ...typography.bodyStrong, color: colors.textMuted, fontSize: 13 },
  cardBody: { ...typography.body, color: colors.text, lineHeight: 21 },
  syntheticTag: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: colors.warn },
  scrubHint: { fontSize: 10, color: colors.textFaint, fontStyle: 'italic' },
  aboutText: { ...typography.body, color: colors.textMuted, lineHeight: 21 },
  aboutMore: { fontSize: 12, fontWeight: '700', color: colors.accent, marginTop: 2 },
  compareEmpty: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  thisMarket: { fontSize: 11, color: colors.textFaint, fontStyle: 'italic' },
  externalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  externalText: { fontSize: 13, fontWeight: '700' },
  brandGlyph: { width: 18, height: 18, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  brandGlyphText: { fontSize: 11, fontWeight: '700', color: colors.bg },
  aiHeader: { marginTop: spacing.md, gap: 2 },
  sectionKicker: { ...typography.kicker, color: colors.textFaint },
  aiDisclaimer: { fontSize: 11, color: colors.textFaint },
  gateCard: {
    ...card,
    borderColor: colors.accent,
    gap: spacing.sm,
  },
  gateTitle: { ...typography.heading, color: colors.text },
  edgeCard: { borderColor: colors.accent, backgroundColor: colors.accentDim, gap: spacing.sm },
  bone: { height: 12, borderRadius: 6, backgroundColor: colors.accent },
  skeletonStatus: { ...typography.caption, color: colors.accent, textAlign: 'center' },
  edgeHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  edgeLabel: { ...typography.kicker, color: colors.accent },
  edgeBody: { ...typography.body, color: colors.text, lineHeight: 22 },
  freshness: { fontSize: 10, color: colors.textFaint },
  citation: { color: colors.accent, fontWeight: '700' },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  sourceRowActive: { backgroundColor: colors.accentDim },
  sourceIndex: { ...typography.mono, color: colors.accent, fontSize: 12 },
  sourceTitle: { ...typography.caption, color: colors.text, lineHeight: 16 },
  sourceDate: { fontSize: 10, color: colors.textFaint, marginTop: 1 },
  gateBody: { ...typography.body, color: colors.textMuted, lineHeight: 21, textTransform: 'capitalize' },
  teaserWrap: { gap: spacing.xs, marginBottom: spacing.xs },
  teaserText: { ...typography.body, color: colors.text, lineHeight: 21 },
  teaserBlur: { ...typography.body, color: colors.textFaint, lineHeight: 21, opacity: 0.45 },
  explainBtn: { ...buttonPrimary, flexDirection: 'row', gap: spacing.sm },
  explainText: { color: colors.bg, fontWeight: '700' },
  listRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  metaLabel: { color: colors.textMuted, ...typography.body },
  metaValue: { color: colors.text, ...typography.mono },
  confChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  confDot: { width: 6, height: 6, borderRadius: 3 },
  confText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
});
