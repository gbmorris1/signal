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
import { colors, radius, spacing, typography, buttonPrimary } from '@/theme';
import { getMarketSource, getCombinedSource } from '@/services/markets';
import { generateAnalysis, isGated } from '@/services/ai';
import { track } from '@/lib/analytics';
import { ProbabilityChart } from '@/components/ProbabilityChart';
import { ScoreExplainer } from '@/components/ScoreExplainer';
import { OutcomeSplit } from '@/components/OutcomeSplit';
import { ProbabilityGauge } from '@/components/ProbabilityGauge';
import { ExternalLinkSheet } from '@/components/ExternalLinkSheet';
import { Bone } from '@/components/Skeleton';
import { EdgeMeter } from '@/components/EdgeMeter';
import { PlatformLogo } from '@/components/PlatformLogo';
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

  // Sibling outcomes when this market is one leg of a multi-outcome event —
  // passed to the AI so it reasons about relative value across the field.
  const { data: siblings = [] } = useQuery<Market[]>({
    queryKey: ['siblings', market?.eventId],
    enabled: !!market?.eventId,
    queryFn: async () => {
      const all = await source.listMarkets();
      return all.filter((m) => m.eventId === market!.eventId && m.id !== market!.id);
    },
  });

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
      // and returns a gated teaser when the user is over their limit. For an
      // event leg, hand the model the rest of the field for relative-value context.
      const field =
        market.eventId && siblings.length > 0
          ? [
              { label: market.outcomeLabel ?? market.title, probability: market.probability },
              ...siblings.map((s) => ({ label: s.outcomeLabel ?? s.title, probability: s.probability })),
            ]
          : undefined;
      const result = await generateAnalysis(market, snapshots, entitlements.aiDepth, field);
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
          <Pressable
            hitSlop={10}
            onPress={onToggleSave}
            style={[styles.saveStar, saved && styles.saveStarOn]}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from watchlist' : 'Save to watchlist'}
          >
            <Ionicons name={saved ? 'star' : 'star-outline'} size={17} color={saved ? colors.bg : colors.textMuted} />
          </Pressable>
        </View>
        <Text style={styles.title}>{market.title}</Text>

        <View style={[styles.card, styles.headlineCard]}>
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
          <>
            {comparables.map((c: Market) => (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/market/${encodeURIComponent(c.id)}`)}
              >
                <CompareRow
                  label={c.platform}
                  probability={c.probability}
                  spread={c.probability - market.probability}
                />
              </Pressable>
            ))}
            {/* Carried over from the removed spreads screen: the caveat is the
                most important thing on this panel. A gap is research, not an
                arb, and saying so is what keeps this honest. */}
            <Text style={styles.compareEmpty}>
              A gap usually means the two venues resolve on{' '}
              <Text style={styles.compareEmphasis}>different criteria</Text> — read both before
              assuming it&rsquo;s free money.
            </Text>
          </>
        ) : (
          // Deliberately claims only what we know. The matcher fails closed, so
          // "no equivalent found" is honest where "no equivalent exists" would
          // be asserting a fact we haven't established.
          <Text style={styles.compareEmpty}>
            No matching {market.platform === 'polymarket' ? 'Kalshi' : 'Polymarket'} market
            identified. A second venue is shown only when the question and its outcome match
            exactly — near-misses price different questions.
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
            <PlatformLogo platform={market.platform} size={15} color={colors.bg} />
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
            <Ionicons name="sparkles" size={15} color={colors.bg} />
            <Text style={styles.explainText}>Unlock AI analysis</Text>
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
            marketProbability={market.probability}
            onCite={onCite}
            highlightedSource={highlightedSource}
          />
          {entitlements.tier !== 'trader' && (
            <UpsellCard
              tier={entitlements.tier}
              onUpgrade={(highlight) => {
                track('paywall_view', { source: 'analysis_upsell', market_id: market.id });
                router.push(`/paywall?highlight=${highlight}`);
              }}
            />
          )}
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

/** Animated placeholder while the model runs - reads as "working", not frozen. */
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
  marketProbability,
  onCite,
  highlightedSource,
}: {
  analysis: AIAnalysis;
  marketProbability: number;
  onCite: (n: number) => void;
  highlightedSource: number | null;
}) {
  const confColor = CONFIDENCE_COLOR[analysis.confidence] ?? colors.accent;
  return (
    <View style={{ gap: spacing.md }}>
      {analysis.edge ? (
        <View style={[styles.card, styles.edgeCard]}>
          <View style={styles.edgeHead}>
            <Ionicons name="flash" size={15} color={colors.accent} />
            <Text style={styles.edgeLabel}>ODDIQ'S EDGE</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.freshness}>Updated {timeAgo(analysis.createdAt)}</Text>
          </View>
          <CitedText text={analysis.edge} style={styles.edgeBody} onCite={onCite} />
          {analysis.aiProbabilityEstimate != null && (
            <View style={styles.meterWrap}>
              <EdgeMeter
                marketProbability={marketProbability}
                oddiqProbability={analysis.aiProbabilityEstimate}
              />
            </View>
          )}
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

/**
 * After the analysis, show a non-Trader reader exactly what a higher tier
 * would have added to THIS report - concrete depth/news/quota differences,
 * not a generic "upgrade now" nag.
 */
function UpsellCard({
  tier,
  onUpgrade,
}: {
  tier: 'free' | 'pro';
  onUpgrade: (highlight: 'pro' | 'trader') => void;
}) {
  const isFree = tier === 'free';
  const kicker = isFree ? "YOU'RE SEEING THE QUICK READ" : 'GO DEEPER';
  const title = isFree
    ? 'Pro & Trader read the news behind the move.'
    : 'Trader digs deeper than Pro.';
  const rows = isFree
    ? [
        { icon: 'newspaper-outline' as const, text: 'Pro grounds every analysis in live news sources with citations' },
        { icon: 'layers-outline' as const, text: 'A deeper thesis and 25 analyses a day' },
        { icon: 'infinite-outline' as const, text: 'Trader: the deepest reasoning, unlimited analyses' },
      ]
    : [
        { icon: 'newspaper-outline' as const, text: 'Trader reads more sources per analysis' },
        { icon: 'layers-outline' as const, text: 'The deepest reasoning depth: second-order effects and timing' },
        { icon: 'infinite-outline' as const, text: 'No daily cap. Analyze any market, any time' },
      ];
  const highlight: 'pro' | 'trader' = isFree ? 'pro' : 'trader';
  const cta = isFree ? 'See Pro & Trader' : 'Upgrade to Trader';

  return (
    <View style={[styles.card, styles.upsellCard]}>
      <View style={styles.edgeHead}>
        <Ionicons name="lock-open-outline" size={14} color={colors.accent} />
        <Text style={styles.edgeLabel}>{kicker}</Text>
      </View>
      <Text style={styles.upsellTitle}>{title}</Text>
      <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
        {rows.map((r) => (
          <View key={r.text} style={styles.listRow}>
            <Ionicons name={r.icon} size={14} color={colors.accent} style={{ marginTop: 2 }} />
            <Text style={[styles.cardBody, { flex: 1, fontSize: 13 }]}>{r.text}</Text>
          </View>
        ))}
      </View>
      <Pressable
        style={[styles.explainBtn, { marginTop: spacing.md }]}
        onPress={() => onUpgrade(highlight)}
      >
        <Text style={styles.explainText}>{cta}</Text>
      </Pressable>
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
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  loading: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.md },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  saveStar: {
    width: 34,
    height: 34,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveStarOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  // The question is the headline of the piece.
  title: { ...typography.title, color: colors.text, marginTop: spacing.md },
  card: { paddingVertical: spacing.lg, borderTopColor: colors.rule, borderTopWidth: 1, gap: spacing.sm },
  headlineCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md, borderTopWidth: 0 },
  moveLine: { ...typography.statSmall, fontSize: 12 },
  // Ruled masthead strip, no card.
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopColor: colors.rule,
    borderTopWidth: 1,
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: 1, height: 26, backgroundColor: colors.rule },
  statValue: { ...typography.statLarge, fontSize: 18, color: colors.text },
  statLabel: { ...typography.ticker, fontSize: 8.5, color: colors.textFaint },
  scoreLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  chartCard: { paddingTop: spacing.lg, borderTopColor: colors.rule, borderTopWidth: 1, gap: spacing.sm },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { ...typography.ticker, color: colors.textFaint },
  cardBody: { ...typography.prose, color: colors.text },
  syntheticTag: { ...typography.ticker, fontSize: 8.5, color: colors.warn },
  scrubHint: { ...typography.ticker, fontSize: 8.5, color: colors.textGhost },
  aboutText: { ...typography.prose, color: colors.textMuted },
  aboutMore: { ...typography.caption, color: colors.accent, marginTop: 2 },
  compareEmpty: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  compareEmphasis: { color: colors.text, fontFamily: typography.heading.fontFamily },
  thisMarket: { ...typography.ticker, fontSize: 8.5, color: colors.textFaint },
  externalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  externalText: { ...typography.button, fontSize: 13 },
  brandGlyph: { width: 20, height: 20, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center' },
  aiHeader: { marginTop: spacing.lg, gap: 3, borderTopColor: colors.rule, borderTopWidth: 1, paddingTop: spacing.lg },
  sectionKicker: { ...typography.ticker, color: colors.accent },
  aiDisclaimer: { ...typography.caption, fontSize: 11, color: colors.textFaint },
  gateCard: {
    borderColor: colors.accentEdge,
    borderWidth: 1,
    borderRadius: radius.xs,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  gateTitle: { ...typography.heading, color: colors.text },
  // The edge: an editorial pull-quote with an accent rule down its spine.
  edgeCard: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    backgroundColor: colors.accentDim,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 0,
    gap: spacing.sm,
  },
  upsellCard: {
    borderColor: colors.rule,
    borderWidth: 1,
    borderRadius: radius.xs,
    padding: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  upsellTitle: { ...typography.heading, color: colors.text },
  bone: { height: 11, borderRadius: radius.xs, backgroundColor: colors.accent },
  skeletonStatus: { ...typography.ticker, fontSize: 8.5, color: colors.accent, textAlign: 'center' },
  edgeHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  edgeLabel: { ...typography.ticker, color: colors.accent },
  edgeBody: { ...typography.prose, color: colors.text, fontSize: 15, lineHeight: 24 },
  meterWrap: { marginTop: spacing.sm, paddingTop: spacing.md, borderTopColor: colors.accentEdge, borderTopWidth: 1 },
  freshness: { ...typography.ticker, fontSize: 8, color: colors.textFaint },
  citation: { ...typography.stat, fontSize: 11, color: colors.accent },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.xs,
  },
  sourceRowActive: { backgroundColor: colors.accentDim },
  sourceIndex: { ...typography.stat, color: colors.accent, fontSize: 11 },
  sourceTitle: { ...typography.caption, color: colors.text, lineHeight: 17 },
  sourceDate: { ...typography.ticker, fontSize: 8, color: colors.textFaint, marginTop: 2 },
  gateBody: { ...typography.prose, color: colors.textMuted, fontSize: 13.5 },
  teaserWrap: { gap: spacing.xs, marginBottom: spacing.xs },
  teaserText: { ...typography.prose, color: colors.text },
  teaserBlur: { ...typography.prose, color: colors.textFaint, opacity: 0.45 },
  explainBtn: { ...buttonPrimary, flexDirection: 'row', gap: spacing.sm },
  explainText: { ...typography.button, color: colors.bg },
  listRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  metaLabel: { ...typography.caption, color: colors.textMuted },
  metaValue: { ...typography.stat, color: colors.text },
  confChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  confDot: { width: 5, height: 5, borderRadius: 1 },
  confText: { ...typography.ticker, fontSize: 8.5 },
});
