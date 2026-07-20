import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { colors, radius, spacing, typography, card } from '@/theme';
import { fetchAlerts, markAlertRead } from '@/services/alerts';
import { Enter } from '@/components/motion';
import { useAuth } from '@/state/auth';
import type { Alert } from '@/types';

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'TODAY';
  if (same(d, yesterday)) return 'YESTERDAY';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();
}

export default function AlertsScreen() {
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const { data: rawAlerts = [], isLoading, refetch } = useQuery<Alert[]>({
    queryKey: ['alerts', profile?.id ?? 'demo'],
    queryFn: () => fetchAlerts(profile?.id ?? null),
  });

  // Overlay locally-marked-read state so a tap reflects instantly without
  // waiting on a refetch.
  const alerts = useMemo(
    () => rawAlerts.map((a) => (readIds.has(a.id) ? { ...a, read: true } : a)),
    [rawAlerts, readIds],
  );
  const unreadCount = alerts.filter((a) => !a.read).length;

  const onRefresh = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  function markRead(alert: Alert) {
    if (alert.read) return;
    setReadIds((prev) => new Set(prev).add(alert.id));
    if (profile) void markAlertRead(profile.id, alert.id);
  }

  function markAllRead() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const a of alerts) next.add(a.id);
      return next;
    });
    if (profile) for (const a of alerts) if (!a.read) void markAlertRead(profile.id, a.id);
  }

  // Group chronologically by day.
  const sections = useMemo(() => {
    const byDay = new Map<string, Alert[]>();
    for (const a of alerts) {
      const key = dayLabel(a.createdAt);
      byDay.set(key, [...(byDay.get(key) ?? []), a]);
    }
    return [...byDay.entries()].map(([title, data]) => ({ title, data }));
  }, [alerts]);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(a) => a.id}
      contentContainerStyle={styles.content}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      ListHeaderComponent={
        unreadCount > 0 ? (
          <Pressable
            style={styles.markAllRow}
            onPress={markAllRead}
            accessibilityRole="button"
            accessibilityLabel="Mark all alerts read"
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        ) : null
      }
      renderSectionHeader={({ section }) => (
        <Text style={styles.dayLabel}>{section.title}</Text>
      )}
      renderItem={({ item, index }) => (
        <Enter index={Math.min(index, 5)}>
          <AlertRow alert={item} onPress={() => markRead(item)} />
        </Enter>
      )}
      SectionSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      ListEmptyComponent={
        isLoading ? null : (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={28} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>No alerts yet</Text>
            <Text style={styles.emptyBody}>
              Save markets to your watchlist. When one moves sharply, the alert lands here and on
              your lock screen.
            </Text>
          </View>
        )
      }
    />
  );
}

const BADGE: Record<Alert['kind'], { label: string; style: 'badgeAi' | 'badgeMove' | 'badgeVol'; stripe: boolean }> = {
  ai_shift: { label: 'AI SHIFT', style: 'badgeAi', stripe: true },
  volume_spike: { label: 'VOLUME', style: 'badgeVol', stripe: true },
  move: { label: 'MOVE', style: 'badgeMove', stripe: false },
};

function AlertRow({ alert, onPress }: { alert: Alert; onPress: () => void }) {
  const b = BADGE[alert.kind] ?? BADGE.move;
  const stripeColor = alert.kind === 'volume_spike' ? colors.warn : colors.accent;
  const unread = !alert.read;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        // Unread: raised, brighter surface + coloured stripe. Read: flattened
        // to the page and dimmed, so the two are unmistakable at a glance.
        unread ? styles.cardUnread : styles.cardRead,
        unread && b.stripe && { borderLeftWidth: 3, borderLeftColor: stripeColor, borderColor: stripeColor },
        pressed && { backgroundColor: colors.surfaceElevated },
      ]}
      onPress={() => {
        onPress();
        router.push(`/market/${encodeURIComponent(alert.marketId)}`);
      }}
    >
      <View style={styles.rowTop}>
        <View style={styles.badgeRow}>
          {unread && <View style={styles.unreadDot} />}
          <Text style={[styles.badge, styles[b.style], !unread && styles.badgeRead]}>{b.label}</Text>
        </View>
        <Text style={styles.time}>{unread ? timeAgo(alert.createdAt) : `Read · ${timeAgo(alert.createdAt)}`}</Text>
      </View>
      <Text style={[styles.alertTitle, !unread && styles.textRead]}>{alert.title}</Text>
      <Text style={styles.body}>{alert.body}</Text>
      {unread && <Text style={styles.viewLink}>View market →</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, flexGrow: 1 },
  markAllRow: { alignSelf: 'flex-end', paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  markAllText: { ...typography.ticker, color: colors.accent },
  dayLabel: {
    ...typography.ticker,
    color: colors.textFaint,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  // Alerts are ruled rows; state is carried by ground + stripe, not chrome.
  card: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  cardUnread: { backgroundColor: colors.surface },
  cardRead: { opacity: 0.5 },
  textRead: { color: colors.textMuted },
  badgeRead: { opacity: 0.6 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unreadDot: { width: 5, height: 5, borderRadius: 1, backgroundColor: colors.accent },
  badge: { ...typography.ticker, fontSize: 8.5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.xs, overflow: 'hidden' },
  badgeAi: { color: colors.bg, backgroundColor: colors.accent },
  badgeVol: { color: colors.bg, backgroundColor: colors.warn },
  badgeMove: { color: colors.textMuted, backgroundColor: colors.surfaceHigh },
  time: { ...typography.ticker, fontSize: 8.5, color: colors.textFaint },
  alertTitle: { ...typography.heading, color: colors.text },
  body: { ...typography.prose, fontSize: 13, color: colors.textMuted },
  viewLink: { ...typography.ticker, fontSize: 8.5, color: colors.accent },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.heading, color: colors.textMuted },
  emptyBody: { ...typography.caption, color: colors.textFaint, textAlign: 'center', lineHeight: 18 },
});
