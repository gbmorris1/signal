import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@/theme';

/**
 * Shimmer bone. A static block reads as "broken" for the first beat before the
 * eye recognises the pattern; the pulse is what says "loading".
 */
export function Bone({ style }: { style?: StyleProp<ViewStyle> }) {
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  const opacity = sweep.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 1, 0.45] });
  return <Animated.View style={[styles.bone, style, { opacity }]} />;
}

/** Placeholder rows matching the ruled market-row layout. */
export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row}>
          <Bone style={{ width: '34%', height: 8 }} />
          <Bone style={{ width: '88%', height: 15 }} />
          <Bone style={{ width: '100%', height: 3 }} />
          <Bone style={{ width: '42%', height: 12 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: { height: 10, borderRadius: radius.xs, backgroundColor: colors.surfaceHigh },
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
});
