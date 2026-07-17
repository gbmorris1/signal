import { useRef, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radius } from '@/theme';

const ACTION_WIDTH = 84;

/** Tracks which row is currently swiped open so opening a new one closes the last. */
let openCloser: (() => void) | null = null;

/**
 * Swipe-left-to-reveal a "Remove" action, matching the system convention used
 * by Mail/Messages/Reminders (no react-native-gesture-handler dependency —
 * built on PanResponder + Animated, same idiom the chart scrubber already
 * uses in this codebase).
 */
export function SwipeableRow({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  function animateTo(open: boolean) {
    isOpen.current = open;
    Animated.spring(translateX, {
      toValue: open ? -ACTION_WIDTH : 0,
      useNativeDriver: true,
      speed: 22,
      bounciness: 0,
    }).start();
  }

  function close() {
    if (isOpen.current) animateTo(false);
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        if (openCloser && openCloser !== close) openCloser();
      },
      onPanResponderMove: (_, g) => {
        const base = isOpen.current ? -ACTION_WIDTH : 0;
        const next = Math.min(0, Math.max(-ACTION_WIDTH - 24, base + g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const base = isOpen.current ? -ACTION_WIDTH : 0;
        const projected = base + g.dx;
        const shouldOpen = projected < -ACTION_WIDTH / 2;
        if (shouldOpen !== isOpen.current && shouldOpen) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        animateTo(shouldOpen);
        openCloser = shouldOpen ? close : null;
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  return (
    <View style={styles.wrap}>
      <View style={styles.actionLayer}>
        <Pressable
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel="Remove from watchlist"
          onPress={() => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onRemove();
          }}
        >
          <Text style={styles.actionText}>Remove</Text>
        </Pressable>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: 'hidden' },
  actionLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  action: {
    width: ACTION_WIDTH,
    backgroundColor: colors.down,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
