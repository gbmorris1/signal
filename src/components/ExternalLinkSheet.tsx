import { useState } from 'react';
import { Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, shadows, buttonPrimary } from '@/theme';
import { PlatformLogo } from '@/components/PlatformLogo';

const PLATFORM = {
  polymarket: { name: 'Polymarket', color: colors.polymarket, dim: colors.polymarketDim },
  kalshi: { name: 'Kalshi', color: colors.kalshi, dim: colors.kalshiDim },
} as const;

/**
 * Bottom-sheet confirmation before leaving ODDIQ for a third-party trading
 * venue. Nicer than a system alert, and offers "don't show again" (the caller
 * persists the choice).
 */
export function ExternalLinkSheet({
  platform,
  visible,
  onCancel,
  onContinue,
}: {
  platform: 'polymarket' | 'kalshi';
  visible: boolean;
  onCancel: () => void;
  onContinue: (dontAskAgain: boolean) => void;
}) {
  const [dontAsk, setDontAsk] = useState(false);
  const p = PLATFORM[platform];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={[styles.glyph, { backgroundColor: p.dim, borderColor: p.color }]}>
            <View style={[styles.glyphInner, { backgroundColor: p.color }]}>
              <PlatformLogo platform={platform} size={16} color={colors.bg} />
            </View>
          </View>

          <Text style={styles.title}>Leave ODDIQ for {p.name}?</Text>
          <Text style={styles.body}>
            {p.name} is a separate third-party trading platform. ODDIQ is research and analysis
            only and never places trades. You'll continue on {p.name}'s site, subject to their
            terms and your local eligibility.
          </Text>

          <Pressable style={styles.checkRow} onPress={() => setDontAsk((v) => !v)}>
            <View style={[styles.checkbox, dontAsk && styles.checkboxOn]}>
              {dontAsk && <Ionicons name="checkmark" size={13} color={colors.bg} />}
            </View>
            <Text style={styles.checkLabel}>Don't show this again</Text>
          </Pressable>

          <Pressable
            style={[styles.continueBtn, { backgroundColor: p.color }]}
            onPress={() => onContinue(dontAsk)}
          >
            <Text style={styles.continueText}>Continue to {p.name}</Text>
            <Ionicons name="open-outline" size={15} color={colors.bg} />
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopColor: colors.ruleStrong,
    borderTopWidth: 1,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    alignItems: 'center',
    ...shadows.sheet,
  },
  glyph: {
    width: 46,
    height: 46,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphInner: { width: 28, height: 28, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title, fontSize: 19, color: colors.text, textAlign: 'center' },
  body: { ...typography.prose, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', paddingVertical: spacing.xs },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkLabel: { ...typography.caption, color: colors.textMuted },
  continueBtn: {
    ...buttonPrimary,
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
  continueText: { ...typography.button, color: colors.bg, fontSize: 15 },
  cancelBtn: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { ...typography.button, color: colors.textMuted },
});
