import { useState } from 'react';
import { Alert as RNAlert, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { PLANS } from '@/data/subscriptions';
import { useAuth } from '@/state/auth';
import { useEntitlement } from '@/state/entitlement';
import { getNotificationService } from '@/services/notifications';

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  active: 'Active Trader',
  professional: 'Professional',
};

export default function ProfileScreen() {
  const { profile, demo, signOut, setPushToken } = useAuth();
  const { tier } = useEntitlement();
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  async function enablePush() {
    const svc = getNotificationService();
    const granted = await svc.requestPermissions();
    if (!granted) {
      setPushStatus('Permission denied or unavailable on this device/simulator.');
      return;
    }
    const token = await svc.getPushToken();
    if (token) await setPushToken(token);
    await svc.sendTestNotification();
    setPushStatus(
      token ? 'Enabled. A test notification will arrive shortly.' : 'Enabled (no token on simulator). Test notification scheduled.',
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        {profile ? (
          <>
            <Text style={styles.name}>{profile.displayName ?? profile.email}</Text>
            <Text style={styles.sub}>{profile.email}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaChip}>{LEVEL_LABEL[profile.experience]}</Text>
              <Text style={styles.metaChip}>{profile.interests.length} interests</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.name}>Demo mode</Text>
            <Text style={styles.sub}>Create an account to sync your watchlist and alerts.</Text>
            <Pressable style={styles.cta} onPress={() => router.push('/auth')}>
              <Text style={styles.ctaText}>Create account</Text>
            </Pressable>
          </>
        )}
      </View>

      {profile && (
        <View style={styles.card}>
          <Text style={styles.section}>Notifications</Text>
          <Pressable style={styles.cta} onPress={enablePush}>
            <Text style={styles.ctaText}>Enable push & send test</Text>
          </Pressable>
          {pushStatus && <Text style={styles.status}>{pushStatus}</Text>}
        </View>
      )}

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Subscription</Text>
        <Pressable onPress={() => router.push('/paywall')}>
          <Text style={styles.manage}>Manage</Text>
        </Pressable>
      </View>
      {PLANS.map((p) => {
        const current = tier === p.tier;
        return (
          <View key={p.tier} style={[styles.plan, current && { borderColor: colors.accent }]}>
            <View style={styles.planHead}>
              <Text style={styles.planName}>{p.name}</Text>
              <Text style={styles.planPrice}>{p.priceLabel}</Text>
            </View>
            {p.features.map((f) => (
              <Text key={f} style={styles.feature}>
                • {f}
              </Text>
            ))}
            {current && <Text style={styles.current}>Current plan</Text>}
          </View>
        );
      })}

      {profile && !demo && (
        <Pressable
          style={styles.signout}
          onPress={() =>
            RNAlert.alert('Sign out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ])
          }
        >
          <Text style={styles.signoutText}>Sign out</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  name: { ...typography.heading, color: colors.text },
  sub: { ...typography.caption, color: colors.textMuted },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  metaChip: {
    ...typography.caption,
    color: colors.textMuted,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  section: { ...typography.bodyStrong, color: colors.textMuted, marginTop: spacing.xs },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  manage: { ...typography.caption, color: colors.accent, fontWeight: '600' },
  cta: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  ctaText: { color: colors.bg, fontWeight: '700' },
  status: { ...typography.caption, color: colors.up, marginTop: spacing.xs },
  plan: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
  },
  planHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  planName: { ...typography.heading, color: colors.text },
  planPrice: { ...typography.mono, color: colors.accent },
  feature: { ...typography.caption, color: colors.textMuted, lineHeight: 20 },
  current: { ...typography.caption, color: colors.accent, marginTop: spacing.xs, fontWeight: '600' },
  signout: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  signoutText: { color: colors.down, fontWeight: '600' },
});
