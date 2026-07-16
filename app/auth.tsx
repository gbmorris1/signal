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
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth, hasSupabase } from '@/state/auth';

export default function AuthScreen() {
  const { signIn, signUp, enterDemo } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

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
          <View style={styles.brand}>
            <Text style={styles.logo}>Check your email</Text>
            <Text style={styles.tagline}>
              We sent a confirmation link to {sentTo}. Tap it to verify, then come back and sign in.
            </Text>
          </View>
          <Pressable
            style={styles.primary}
            onPress={() => {
              setSentTo(null);
              setMode('signin');
              setPassword('');
            }}
          >
            <Text style={styles.primaryText}>Back to sign in</Text>
          </Pressable>
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
          <Text style={styles.logo}>Signal</Text>
          <Text style={styles.tagline}>The AI research terminal for prediction markets.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.tabs}>
            <Pressable onPress={() => setMode('signup')} style={[styles.tab, mode === 'signup' && styles.tabActive]}>
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Create account</Text>
            </Pressable>
            <Pressable onPress={() => setMode('signin')} style={[styles.tab, mode === 'signin' && styles.tabActive]}>
              <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}>Sign in</Text>
            </Pressable>
          </View>

          <TextInput
            placeholder="Email"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor={colors.textFaint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.primary} onPress={submit} disabled={busy}>
            <Text style={styles.primaryText}>
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondary}
            onPress={() => {
              enterDemo();
              router.replace('/(tabs)');
            }}
          >
            <Text style={styles.secondaryText}>Explore demo first →</Text>
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
  brand: { marginBottom: spacing.xxl },
  logo: { ...typography.display, color: colors.text, fontSize: 40 },
  tagline: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  form: { gap: spacing.md },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  tabText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: colors.text },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    ...typography.body,
  },
  error: { color: colors.down, ...typography.caption },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  primaryText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
  secondary: { alignItems: 'center', paddingVertical: spacing.sm },
  secondaryText: { color: colors.accent, fontWeight: '600' },
  note: { color: colors.textFaint, ...typography.caption, textAlign: 'center', marginTop: spacing.sm },
});
