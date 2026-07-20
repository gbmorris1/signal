import { memo } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, categoryColors, radius, spacing, typography } from '@/theme';
import type { EventGroup } from '@/types';

const PREVIEW = 3;

/**
 * A multi-outcome event as one ruled row: the field as a mini leaderboard.
 * Serif for the names (read), mono for ranks and percentages (compare).
 */
function EventCardInner({ group }: { group: EventGroup }) {
  const top = group.outcomes.slice(0, PREVIEW);
  const rest = group.outcomes.length - top.length;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => router.push(`/event/${encodeURIComponent(group.eventId)}`)}
      accessibilityRole="button"
      accessibilityLabel={`${group.title}, ${group.outcomes.length} outcomes`}
    >
      <View style={styles.meta}>
        <View style={styles.metaLeft}>
          <View
            style={[
              styles.catDot,
              { backgroundColor: categoryColors[group.category] ?? colors.textFaint },
            ]}
          />
          <Text style={styles.metaText} numberOfLines={1}>
            {group.outcomes[0]?.platform ?? 'kalshi'} · {group.category}
          </Text>
        </View>
        <Text style={styles.count}>{group.outcomes.length} outcomes</Text>
      </View>

      <Text style={styles.question} numberOfLines={2}>
        {group.title}
      </Text>

      <View style={styles.board}>
        {top.map((o, i) => {
          const lead = i === 0;
          return (
            <View key={o.id} style={styles.line}>
              <Text style={[styles.rank, lead && { color: colors.accent }]}>{i + 1}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {o.outcomeLabel ?? o.title}
              </Text>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.max(2, Math.round(o.probability * 100))}%`,
                      backgroundColor: lead ? colors.accent : colors.textGhost,
                    },
                  ]}
                />
              </View>
              <Text style={styles.pct}>{Math.round(o.probability * 100)}%</Text>
            </View>
          );
        })}
      </View>

      {rest > 0 && (
        <Text style={styles.more}>
          +{rest} more outcome{rest === 1 ? '' : 's'}
        </Text>
      )}
    </Pressable>
  );
}

export const EventCard = memo(EventCardInner, (a, b) => {
  if (a.group.eventId !== b.group.eventId) return false;
  if (a.group.outcomes.length !== b.group.outcomes.length) return false;
  return a.group.outcomes[0]?.probability === b.group.outcomes[0]?.probability;
});

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  pressed: { backgroundColor: colors.surface },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  catDot: { width: 5, height: 5, borderRadius: 1 },
  metaText: { ...typography.ticker, color: colors.textFaint, flexShrink: 1 },
  count: { ...typography.ticker, color: colors.accent },
  question: { ...typography.heading, color: colors.text },
  board: { gap: 7, marginTop: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rank: { ...typography.statSmall, color: colors.textFaint, width: 10 },
  name: { ...typography.prose, fontSize: 13.5, color: colors.text, flex: 1 },
  track: {
    width: 66,
    height: 3,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.xs,
    overflow: 'hidden',
  },
  fill: { height: 3, borderRadius: radius.xs },
  pct: { ...typography.stat, fontSize: 12.5, color: colors.text, width: 34, textAlign: 'right' },
  more: { ...typography.caption, color: colors.accent, fontSize: 11.5 },
});
