import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { colors, radius, spacing, typography, card } from '@/theme';
import { fetchAlerts } from '@/services/alerts';
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
  const { data: alerts = [], isLoading, refetch } = useQuery<Alert[]>({
    queryKey: ['alerts', profile?.id ?? 'demo'],
    queryFn: () => fetchAlerts(profile?.id ?? null),
  });

  const onRefresh = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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
      renderSectionHeader={({ section }) => (
        <Text style={styles.dayLabel}>{section.title}</Text>
      )}
      renderItem={({ item, index }) => (
        <Enter index={Math.min(index, 5)}>
          <AlertRow alert={item} />
        </Enter>
      )}
      SectionSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListEmptyComponent={
        isLoading ? null : (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={28} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>No alerts yet</Text>
            <Text style={styles.emptyBody}>
              Save markets to your watchlist — when one moves sharply, the alert lands here and on
              your lock screen.
            </Text>
          </View>
        )
      }
    />
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const premium = alert.kind === 'ai_shift';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        premium && { borderColor: colors.accent },
        pressed && { backgroundColor: colors.surfaceElevated },
      ]}
      onPress={() => router.push(`/market/${encodeURIComponent(alert.marketId)}`)}
    >
      <View style={styles.rowTop}>
        <View style={styles.badgeRow}>
          {!alert.read && <View style={styles.unreadDot} />}
          <Text style={[styles.badge, premium ? styles.badgeAi : styles.badgeMove]}>
            {premium ? 'AI SHIFT' : 'MOVE'}
          </Text>
        </View>
        <Text style={styles.time}>{timeAgo(alert.createdAt)}</Text>
      </View>
      <Text style={styles.alertTitle}>{alert.title}</Text>
      <Text style={styles.body}>{alert.body}</Text>
      <Text style={styles.viewLink}>View market →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  dayLabel: { ...typography.kicker, color: colors.textFaint, marginBottom: spacing.sm, marginTop: spacing.sm },
  card: {
    ...card,
    gap: spacing.sm,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  badge: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  badgeAi: { color: colors.bg, backgroundColor: colors.accent },
  badgeMove: { color: colors.textMuted, backgroundColor: colors.surfaceElevated },
  time: { color: colors.textFaint, fontSize: 12 },
  alertTitle: { ...typography.heading, color: colors.text },
  body: { ...typography.body, color: colors.textMuted, lineHeight: 20 },
  viewLink: { fontSize: 12, color: colors.accent, fontWeight: '600' },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.heading, color: colors.textMuted },
  emptyBody: { ...typography.caption, color: colors.textFaint, textAlign: 'center', lineHeight: 18 },
});
