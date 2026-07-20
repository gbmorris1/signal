import { useState, type ReactNode } from 'react';
import { Alert as RNAlert, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, categoryColors, radius, spacing, typography, buttonPrimary } from '@/theme';
import { PLANS } from '@/data/subscriptions';
import { useAuth } from '@/state/auth';
import { useEntitlement } from '@/state/entitlement';
import { getNotificationService } from '@/services/notifications';
import { LEGAL, openManageSubscriptions, openUrl } from '@/lib/legal';

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  active: 'Active Trader',
  professional: 'Professional',
};

export default function ProfileScreen() {
  const { profile, demo, signOut, setPushToken, deleteAccount } = useAuth();
  const { tier } = useEntitlement();
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  const plan = PLANS.find((p) => p.tier === tier);
  const initials = (profile?.displayName ?? profile?.email ?? 'S')
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');

  async function enablePush() {
    const svc = getNotificationService();
    const granted = await svc.requestPermissions();
    if (!granted) {
      setPushStatus('Permission denied or unavailable on this device.');
      return;
    }
    const token = await svc.getPushToken();
    if (token) await setPushToken(token);
    await svc.sendTestNotification();
    setPushStatus('Enabled. A test notification will arrive shortly.');
  }

  // Demo mode: single conversion-focused card.
  if (!profile) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, styles.centered]}>
          <View style={styles.avatarBig}>
            <Ionicons name="person" size={26} color={colors.textFaint} />
          </View>
          <Text style={styles.name}>You're browsing the demo</Text>
          <Text style={styles.subCenter}>
            Create a free account to save markets, get alerts, and sync across devices.
          </Text>
          <Pressable style={styles.cta} onPress={() => router.push('/auth')}>
            <Text style={styles.ctaText}>Create free account</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Identity */}
      <View style={[styles.card, styles.identityRow]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{profile.displayName ?? profile.email}</Text>
          <Text style={styles.sub}>{profile.email}</Text>
        </View>
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>{(plan?.name ?? 'Free').toUpperCase()}</Text>
        </View>
      </View>

      {/* Subscription management */}
      <Text style={styles.section}>SUBSCRIPTION</Text>
      <View style={styles.card}>
        <Row
          icon="diamond-outline"
          title={plan?.name ?? 'Free'}
          sub={
            tier === 'free'
              ? 'Limited AI analysis. Upgrade for reports and alerts.'
              : `${plan?.priceLabel}. Manage or switch plans anytime.`
          }
          action={tier === 'free' ? 'Upgrade' : 'Manage'}
          onPress={() => (tier === 'free' ? router.push('/paywall') : openManageSubscriptions())}
        />
      </View>

      {/* Preferences */}
      <Text style={styles.section}>PREFERENCES</Text>
      <View style={styles.card}>
        <Row
          icon="grid-outline"
          title="Interests"
          subNode={
            profile.interests.length > 0 ? (
              <View style={styles.chipWrap}>
                {profile.interests.map((c) => (
                  <View key={c} style={styles.miniChip}>
                    <View
                      style={[styles.miniDot, { backgroundColor: categoryColors[c] ?? colors.accent }]}
                    />
                    <Text style={styles.miniChipText}>{c[0].toUpperCase() + c.slice(1)}</Text>
                  </View>
                ))}
              </View>
            ) : undefined
          }
          sub={profile.interests.length === 0 ? 'None selected yet' : undefined}
          action="Edit"
          onPress={() => router.push('/onboarding')}
        />
        <View style={styles.divider} />
        <Row
          icon="speedometer-outline"
          title="Experience level"
          sub={LEVEL_LABEL[profile.experience]}
          action="Edit"
          onPress={() => router.push('/onboarding')}
        />
      </View>

      {/* Notifications */}
      <Text style={styles.section}>NOTIFICATIONS</Text>
      <View style={styles.card}>
        <Row
          icon="notifications-outline"
          title="Push alerts"
          sub={pushStatus ?? 'Get notified when watched markets move sharply.'}
          action="Enable"
          onPress={enablePush}
        />
      </View>

      {/* Legal */}
      <Text style={styles.section}>LEGAL</Text>
      <View style={styles.card}>
        <Row icon="shield-checkmark-outline" title="Privacy policy" onPress={() => openUrl(LEGAL.privacyUrl)} />
        <View style={styles.divider} />
        <Row icon="document-text-outline" title="Terms of service" onPress={() => openUrl(LEGAL.termsUrl)} />
      </View>

      {/* Account */}
      <Text style={styles.section}>ACCOUNT</Text>
      <View style={styles.card}>
        <Row
          icon="log-out-outline"
          title="Sign out"
          onPress={() =>
            RNAlert.alert('Sign out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ])
          }
        />
        <View style={styles.divider} />
        <Row
          icon="trash-outline"
          title="Delete account"
          sub="Permanently erases your account and all data."
          destructive
          onPress={() =>
            RNAlert.alert(
              'Delete account',
              'This permanently deletes your account, watchlist, and history. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    const res = await deleteAccount();
                    if (res.error) RNAlert.alert('Could not delete', res.error);
                  },
                },
              ],
            )
          }
        />
      </View>

      <Text style={styles.version}>ODDIQ 0.1.0</Text>
    </ScrollView>
  );
}

function Row({
  icon,
  title,
  sub,
  subNode,
  action,
  destructive = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub?: string;
  subNode?: ReactNode;
  action?: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.rowIcon, destructive && { backgroundColor: colors.downDim }]}>
        <Ionicons name={icon} size={16} color={destructive ? colors.down : colors.textMuted} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowTitle, destructive && { color: colors.down }]}>{title}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
        {subNode}
      </View>
      {action ? (
        <Text style={styles.rowAction}>{action}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  card: { borderTopColor: colors.rule, borderTopWidth: 1, paddingHorizontal: spacing.lg },
  centered: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, borderTopWidth: 0 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.xs,
    borderColor: colors.accentEdge,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBig: {
    width: 56,
    height: 56,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { ...typography.stat, fontSize: 14, color: colors.accent },
  name: { ...typography.heading, color: colors.text },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  subCenter: { ...typography.prose, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  planBadge: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  planBadgeText: { ...typography.ticker, fontSize: 8.5, color: colors.accent },
  section: {
    ...typography.ticker,
    color: colors.textFaint,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...typography.heading, fontSize: 14.5, color: colors.text },
  rowSub: { ...typography.caption, fontSize: 11.5, color: colors.textMuted, lineHeight: 16 },
  rowAction: { ...typography.ticker, fontSize: 9, color: colors.accent },
  divider: { height: 1, backgroundColor: colors.rule },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  miniDot: { width: 4, height: 4, borderRadius: 1 },
  miniChipText: { ...typography.ticker, fontSize: 8, color: colors.textMuted },
  cta: { ...buttonPrimary, paddingHorizontal: spacing.xxl, marginTop: spacing.md },
  ctaText: { ...typography.button, color: colors.bg },
  version: { ...typography.ticker, fontSize: 8, color: colors.textGhost, textAlign: 'center', marginTop: spacing.xl },
});
