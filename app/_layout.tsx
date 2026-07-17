import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { colors } from '@/theme';
import { AuthProvider, useAuth } from '@/state/auth';

const queryClient = new QueryClient();

/** Redirects based on auth + onboarding state. */
function AuthGate() {
  const { loading, isAuthed, demo, needsOnboarding } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const seg0 = segments[0];
    const onAuth = seg0 === 'auth';
    const onOnboarding = seg0 === 'onboarding';
    const canBrowse = isAuthed || demo;

    if (!canBrowse && !onAuth) {
      // Not signed in and not in demo → gate to auth.
      router.replace('/auth');
    } else if (isAuthed && needsOnboarding && !onOnboarding) {
      // Signed in but hasn't finished onboarding.
      router.replace('/onboarding');
    } else if (isAuthed && !needsOnboarding && onAuth) {
      // Fully signed in → done with the entry flow. (Demo users may still
      // visit /auth deliberately; onboarded users may revisit /onboarding
      // from Profile to edit interests — don't bounce either.)
      router.replace('/(tabs)');
    }
  }, [loading, isAuthed, demo, needsOnboarding, segments, router]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="market/[id]" options={{ title: 'Market', headerBackTitle: 'Back' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <AuthGate />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
