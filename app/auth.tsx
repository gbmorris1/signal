import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, buttonPrimary, shadows } from '@/theme';
import { BrandMark } from '@/components/BrandMark';
import { useAuth, hasSupabase } from '@/state/auth';

const VALUE_PROPS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'pulse', text: 'Live odds from Polymarket and Kalshi' },
  { icon: 'sparkles', text: 'AI analysis of why markets move' },
  { icon: 'notifications', text: 'Alerts when your markets shift' },
];

const TAGLINE = 'The AI research terminal for prediction markets';

export default function AuthScreen() {
  const { signIn, signUp, enterDemo, resetPassword, resendConfirmation } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleForgot() {
    setError(null);
    setNotice(null);
    if (!email.includes('@')) {
      setError('Enter your email above first, then tap Forgot password.');
      return;
    }
    const res = await resetPassword(email);
    if (res.error) setError(res.error);
    else setNotice('If an account exists for that email, a reset link is on its way.');
  }

  async function submit() {
    setError(null);
    if (!email.includes('@') || password.length < 6) {
      setError('Enter a valid email and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    const res = mode === 'signup' ? await signUp(email, password) : await signIn(email, password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
    } else if (mode === 'signup' && 'needsConfirmation' in res && res.needsConfirmation) {
      setSentTo(email);
    }
  }

  if (sentTo) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.mark}>
            <Ionicons name="mail-unread" size={30} color={colors.accent} />
          </View>
          <Text style={styles.logo}>Check your email</Text>
          <Text style={styles.tagline}>
            We sent a confirmation link to {sentTo}. Tap it to verify, then come back and sign in.
          </Text>
          <Pressable
            style={[styles.primary, { marginTop: spacing.xxl }]}
            onPress={() => {
              setSentTo(null);
              setMode('signin');
              setPassword('');
            }}
          >
            <Text style={styles.primaryText}>Back to sign in</Text>
          </Pressable>
          <Pressable
            style={styles.forgotBtn}
            onPress={async () => {
              await resendConfirmation(sentTo);
              setNotice('Confirmation email resent.');
            }}
          >
            <Text style={styles.forgotText}>Didn't get it? Resend email</Text>
          </Pressable>
          {notice && <Text style={styles.notice}>{notice}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.brand}>
          <View style={styles.mark}>
            <BrandMark size={44} />
          </View>
          <Text style={styles.logo}>ODDIQ</Text>
          <Text style={styles.tagline}>{TAGLINE}</Text>
        </View>

        <View style={styles.props}>
          {VALUE_PROPS.map((p) => (
            <View key={p.icon} style={styles.propRow}>
              <Ionicons name={p.icon} size={15} color={colors.accent} />
              <Text style={styles.propText}>{p.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.form}>
          <View style={styles.segment}>
            <Pressable
              onPress={() => setMode('signup')}
              style={[styles.segmentTab, mode === 'signup' && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, mode === 'signup' && styles.segmentTextActive]}>
                Create account
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('signin')}
              style={[styles.segmentTab, mode === 'signin' && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, mode === 'signin' && styles.segmentTextActive]}>
                Sign in
              </Text>
            </Pressable>
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={16} color={colors.textFaint} />
            <TextInput
              placeholder="Email"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />
          </View>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.textFaint} />
            <TextInput
              placeholder="Password (6+ characters)"
              placeholderTextColor={colors.textFaint}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />
            <Pressable hitSlop={10} onPress={() => setShowPassword((v) => !v)}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={16}
                color={colors.textFaint}
              />
            </Pressable>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}
          {notice && <Text style={styles.notice}>{notice}</Text>}

          <Pressable style={styles.primary} onPress={submit} disabled={busy}>
            <Text style={styles.primaryText}>
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create free account' : 'Sign in'}
            </Text>
          </Pressable>

          {mode === 'signin' && (
            <Pressable style={styles.forgotBtn} onPress={handleForgot}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          )}

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <Pressable
            style={styles.secondary}
            onPress={() => {
              enterDemo();
              router.replace('/(tabs)');
            }}
          >
            <Ionicons name="compass-outline" size={16} color={colors.text} />
            <Text style={styles.secondaryText}>Explore the demo first</Text>
          </Pressable>

          {!hasSupabase && (
            <Text style={styles.note}>
              Dev mode: accounts are stored locally (no Supabase keys configured).
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.glowAccent,
  },
  logo: { ...typography.display, color: colors.text, fontSize: 38, letterSpacing: 1, textAlign: 'center' },
  tagline: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  props: { gap: spacing.sm, alignSelf: 'center', marginBottom: spacing.xxl },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  propText: { ...typography.caption, color: colors.textMuted },
  form: { gap: spacing.md },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 3,
    marginBottom: spacing.xs,
  },
  segmentTab: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center', borderRadius: radius.md - 3 },
  segmentActive: { backgroundColor: colors.surfaceElevated, ...shadows.card },
  segmentText: { color: colors.textFaint, fontWeight: '700', fontSize: 12 },
  segmentTextActive: { color: colors.text },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  input: { flex: 1, paddingVertical: 14, color: colors.text, ...typography.body },
  error: { color: colors.down, ...typography.caption },
  notice: { color: colors.up, ...typography.caption },
  forgotBtn: { alignItems: 'center', paddingVertical: spacing.xs },
  forgotText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  primary: { ...buttonPrimary, marginTop: spacing.xs },
  primaryText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption, color: colors.textFaint },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  secondaryText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  note: { color: colors.textFaint, ...typography.caption, textAlign: 'center', marginTop: spacing.sm },
});
