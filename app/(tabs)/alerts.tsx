import { FlatList, Text, View, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors, radius, spacing, typography } from '@/theme';
import { fetchAlerts } from '@/services/alerts';
import { useAuth } from '@/state/auth';
import type { Alert } from '@/types';

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export default function AlertsScreen() {
  const { profile } = useAuth();
  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ['alerts', profile?.id ?? 'demo'],
    queryFn: () => fetchAlerts(profile?.id ?? null),
  });

  return (
    <FlatList
      data={alerts}
      keyExtractor={(a) => a.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<Text style={styles.title}>Alerts</Text>}
      renderItem={({ item }) => <AlertRow alert={item} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListEmptyComponent={
        <Text style={styles.empty}>
          {isLoading ? 'Loading alerts…' : 'No alerts yet. Watched markets that move will show up here.'}
        </Text>
      }
    />
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const premium = alert.kind === 'ai_shift';
  return (
    <View style={[styles.card, premium && { borderColor: colors.accent }, !alert.read && styles.unread]}>
      <View style={styles.rowTop}>
        <Text style={[styles.badge, premium ? styles.badgeAi : styles.badgeMove]}>
          {premium ? 'AI SHIFT' : 'MOVE'}
        </Text>
        <Text style={styles.time}>{timeAgo(alert.createdAt)}</Text>
      </View>
      <Text style={styles.alertTitle}>{alert.title}</Text>
      <Text style={styles.body}>{alert.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  unread: { backgroundColor: colors.surfaceElevated },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  badgeAi: { color: colors.bg, backgroundColor: colors.accent },
  badgeMove: { color: colors.textMuted, backgroundColor: colors.surfaceElevated },
  time: { color: colors.textFaint, fontSize: 12 },
  alertTitle: { ...typography.heading, color: colors.text },
  body: { ...typography.body, color: colors.textMuted, lineHeight: 20 },
  empty: { color: colors.textFaint, marginTop: spacing.xl, lineHeight: 20, textAlign: 'center' },
});
