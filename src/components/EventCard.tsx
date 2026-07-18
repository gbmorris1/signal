import { memo } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, categoryColors, radius, spacing, typography, card } from '@/theme';
import { compactUsd } from '@/lib/format';
import { PlatformBadge } from './Chip';
import type { EventGroup } from '@/types';

const PREVIEW = 3;

/** A multi-outcome event as one card: the leading outcomes as a mini leaderboard. */
function EventCardInner({ group }: { group: EventGroup }) {
  const top = group.outcomes.slice(0, PREVIEW);
  const rest = group.outcomes.length - top.length;
  const platform = group.outcomes[0]?.platform ?? 'kalshi';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push(`/event/${encodeURIComponent(group.eventId)}`)}
      accessibilityRole="button"
      accessibilityLabel={`${group.title}, ${group.outcomes.length} outcomes`}
    >
      <View style={styles.topRow}>
        <View style={styles.metaRow}>
          <PlatformBadge platform={platform} />
          <View style={[styles.catDot, { backgroundColor: categoryColors[group.category] ?? colors.textFaint }]} />
          <Text style={styles.category}>{group.category.toUpperCase()}</Text>
        </View>
        <View style={styles.countChip}>
          <Text style={styles.countText}>{group.outcomes.length} OUTCOMES</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {group.title}
      </Text>

      <View style={styles.board}>
        {top.map((o, i) => (
          <View key={o.id} style={styles.row}>
            <Text style={[styles.rank, i === 0 && { color: colors.up }]}>{i + 1}</Text>
            <Text style={styles.label} numberOfLines={1}>
              {o.outcomeLabel ?? o.title}
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${Math.max(3, Math.round(o.probability * 100))}%`, backgroundColor: i === 0 ? colors.up : colors.accent },
                ]}
              />
            </View>
            <Text style={styles.prob}>{Math.round(o.probability * 100)}%</Text>
          </View>
        ))}
      </View>

      <View style={styles.bottomRow}>
        {rest > 0 ? (
          <Text style={styles.more}>+{rest} more outcome{rest === 1 ? '' : 's'}</Text>
        ) : (
          <View />
        )}
        <Text style={styles.vol}>{compactUsd(group.totalVolume)} vol</Text>
      </View>
    </Pressable>
  );
}

export const EventCard = memo(EventCardInner, (a, b) => {
  if (a.group.eventId !== b.group.eventId) return false;
  if (a.group.outcomes.length !== b.group.outcomes.length) return false;
  return a.group.outcomes[0]?.probability === b.group.outcomes[0]?.probability;
});

const styles = StyleSheet.create({
  card: { ...card, gap: spacing.md },
  pressed: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  category: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textFaint },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  countChip: {
    backgroundColor: colors.accentDim,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  countText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6, color: colors.accent },
  title: { ...typography.heading, color: colors.text, lineHeight: 22 },
  board: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rank: { ...typography.mono, fontSize: 12, color: colors.textFaint, width: 12, textAlign: 'center' },
  label: { ...typography.body, color: colors.text, fontSize: 14, flex: 1 },
  barTrack: { width: 64, height: 5, borderRadius: 3, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3 },
  prob: { ...typography.mono, color: colors.text, fontSize: 14, width: 38, textAlign: 'right' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  more: { fontSize: 12, color: colors.accent, fontWeight: '600' },
  vol: { fontSize: 12, color: colors.textFaint, fontVariant: ['tabular-nums'] },
});
