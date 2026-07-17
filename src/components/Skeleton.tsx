import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';

/**
 * Shimmer skeleton bone. A static gray block reads as "broken" for the first
 * beat before the eye recognizes the pattern; the sweeping highlight is what
 * signals "loading" rather than "didn't render."
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

  const opacity = sweep.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 1, 0.5],
  });

  return <Animated.View style={[styles.bone, style, { opacity }]} />;
}

/** Three-line card skeleton matching the market-card layout, used on Home/Discover. */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          <Bone style={{ width: '30%' }} />
          <Bone style={{ width: '85%', height: 16 }} />
          <Bone style={{ width: '40%', height: 24, marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceElevated },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 20,
    gap: 8,
  },
});
