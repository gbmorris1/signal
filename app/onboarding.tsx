import { useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography, buttonPrimary } from '@/theme';
import { useAuth } from '@/state/auth';
import type { Category, ExperienceLevel } from '@/types';

const INTERESTS: { key: Category; label: string }[] = [
  { key: 'politics', label: 'Politics' },
  { key: 'finance', label: 'Finance' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'sports', label: 'Sports' },
  { key: 'world', label: 'World Events' },
  { key: 'technology', label: 'Technology' },
];

const LEVELS: { key: ExperienceLevel; label: string; hint: string }[] = [
  { key: 'beginner', label: 'Beginner', hint: 'New to prediction markets' },
  { key: 'active', label: 'Active Trader', hint: 'I trade regularly' },
  { key: 'professional', label: 'Professional', hint: 'Markets are my job' },
];

export default function OnboardingScreen() {
  const { saveOnboarding } = useAuth();
  const [step, setStep] = useState<0 | 1>(0);
  const [interests, setInterests] = useState<Category[]>([]);
  const [level, setLevel] = useState<ExperienceLevel | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleInterest(c: Category) {
    setInterests((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function finish() {
    if (!level) return;
    setBusy(true);
    await saveOnboarding({ interests, experience: level });
    setBusy(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.step}>Step {step + 1} of 2</Text>

        {step === 0 ? (
          <>
            <Text style={styles.title}>What are you following?</Text>
            <Text style={styles.sub}>Pick the categories you care about. You can change this later.</Text>
            <View style={styles.grid}>
              {INTERESTS.map((i) => {
                const on = interests.includes(i.key);
                return (
                  <Pressable
                    key={i.key}
                    onPress={() => toggleInterest(i.key)}
                    style={[styles.pill, on && styles.pillOn]}
                  >
                    <Text style={[styles.pillText, on && styles.pillTextOn]}>{i.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={[styles.primary, interests.length === 0 && styles.disabled]}
              disabled={interests.length === 0}
              onPress={() => setStep(1)}
            >
              <Text style={styles.primaryText}>Continue</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>How would you describe yourself?</Text>
            <Text style={styles.sub}>This tailors the signals and depth of analysis you see.</Text>
            <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
              {LEVELS.map((l) => {
                const on = level === l.key;
                return (
                  <Pressable
                    key={l.key}
                    onPress={() => setLevel(l.key)}
                    style={[styles.levelCard, on && styles.levelCardOn]}
                  >
                    <Text style={[styles.levelLabel, on && { color: colors.text }]}>{l.label}</Text>
                    <Text style={styles.levelHint}>{l.hint}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={[styles.primary, (!level || busy) && styles.disabled]}
              disabled={!level || busy}
              onPress={finish}
            >
              <Text style={styles.primaryText}>{busy ? 'Setting up…' : 'Start using Signal'}</Text>
            </Pressable>
            <Pressable style={styles.back} onPress={() => setStep(0)}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingTop: spacing.xxl },
  step: { ...typography.caption, color: colors.accent, fontWeight: '600', letterSpacing: 0.5 },
  title: { ...typography.display, color: colors.text, marginTop: spacing.sm, fontSize: 28 },
  sub: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pillOn: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  pillText: { color: colors.textMuted, fontWeight: '600' },
  pillTextOn: { color: colors.text },
  levelCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  levelCardOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  levelLabel: { ...typography.heading, color: colors.textMuted },
  levelHint: { ...typography.caption, color: colors.textFaint, marginTop: 2 },
  primary: { ...buttonPrimary, marginTop: spacing.xxl },
  primaryText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.4 },
  back: { alignItems: 'center', paddingVertical: spacing.md },
  backText: { color: colors.textMuted },
});
