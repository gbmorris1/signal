import { Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { scoreComponents, SCORE_WEIGHTS } from '@/services/markets/polymarketMap';
import type { Market } from '@/types';

const ROWS: Array<{
  key: keyof typeof SCORE_WEIGHTS;
  label: string;
  desc: (m: Market) => string;
}> = [
  {
    key: 'movement',
    label: 'Movement',
    desc: (m) =>
      `Repriced ${Math.abs(Math.round(m.change24h * 100))} points in 24h. Sharp moves mean new information is arriving.`,
  },
  {
    key: 'liquidity',
    label: 'Liquidity',
    desc: (m) => `Real money behind the price. Thin markets are noisy; this one has meaningful volume.`,
  },
  {
    key: 'uncertainty',
    label: 'Uncertainty',
    desc: (m) =>
      `At ${Math.round(m.probability * 100)}%, ${
        Math.abs(m.probability - 0.5) < 0.15
          ? 'this is genuinely contested. The most interesting kind of market.'
          : 'the market leans one way, so there is less open question here.'
      }`,
  },
];

export function ScoreExplainer({
  market,
  visible,
  onClose,
}: {
  market: Market;
  visible: boolean;
  onClose: () => void;
}) {
  const c = scoreComponents(market.change24h, market.volume, market.probability);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.scoreRow}>
            <Text style={styles.bigScore}>{market.aiScore ?? '–'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Signal score</Text>
              <Text style={styles.sub}>
                How much this market deserves your attention right now, 0–100.
              </Text>
            </View>
          </View>

          {ROWS.map((row) => {
            const value = c[row.key];
            const weight = SCORE_WEIGHTS[row.key];
            return (
              <View key={row.key} style={styles.component}>
                <View style={styles.componentHead}>
                  <Text style={styles.componentLabel}>
                    {row.label} <Text style={styles.weight}>· {Math.round(weight * 100)}% of score</Text>
                  </Text>
                  <Text style={styles.componentValue}>{Math.round(value * 100)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(3, value * 100)}%` }]} />
                </View>
                <Text style={styles.componentDesc}>{row.desc(market)}</Text>
              </View>
            );
          })}

          <Text style={styles.footnote}>
            Computed from market data. Not a prediction. The AI's own probability estimate lives in
            the analysis below.
          </Text>

          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
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
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  bigScore: { ...typography.monoDisplay, color: colors.accent },
  title: { ...typography.heading, color: colors.text },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  component: { gap: spacing.xs },
  componentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  componentLabel: { ...typography.bodyStrong, color: colors.text },
  weight: { ...typography.caption, color: colors.textFaint, fontWeight: '400' },
  componentValue: { ...typography.mono, color: colors.textMuted },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  componentDesc: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  footnote: { ...typography.caption, color: colors.textFaint, lineHeight: 18 },
  close: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  closeText: { color: colors.bg, fontWeight: '700' },
});
