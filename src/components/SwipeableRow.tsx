import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radius } from '@/theme';

const ACTION_WIDTH = 84;
const SCREEN_W = Dimensions.get('window').width;
// Past this drag distance, releasing removes the row outright (iOS Mail-style
// full swipe) instead of just resting on the Remove button.
const FULL_SWIPE_THRESHOLD = SCREEN_W * 0.55;

/** Tracks which row is currently swiped open so opening a new one closes the last. */
let openCloser: (() => void) | null = null;

/**
 * Swipe-left row for the watchlist. Two gestures in one:
 *   • a short swipe rests on a red "Remove" button, and
 *   • a full swipe (past ~55% of the screen) flings the row off and removes it
 *     immediately — the fast path most people expect from Mail/Reminders.
 * Built on PanResponder + Animated (no react-native-gesture-handler dep), the
 * same idiom the chart scrubber already uses in this codebase.
 */
export function SwipeableRow({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);
  const armed = useRef(false); // crossed the full-swipe threshold this gesture

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

  function fling() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Animated.timing(translateX, {
      toValue: -SCREEN_W,
      duration: 180,
      useNativeDriver: true,
    }).start(() => onRemove());
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        armed.current = false;
        if (openCloser && openCloser !== close) openCloser();
      },
      onPanResponderMove: (_, g) => {
        const base = isOpen.current ? -ACTION_WIDTH : 0;
        // Allow dragging the full width so the row can be flung clear.
        const next = Math.min(0, Math.max(-SCREEN_W, base + g.dx));
        translateX.setValue(next);
        const crossed = -next >= FULL_SWIPE_THRESHOLD;
        if (crossed !== armed.current) {
          armed.current = crossed;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); // "will delete" tick
        }
      },
      onPanResponderRelease: (_, g) => {
        const base = isOpen.current ? -ACTION_WIDTH : 0;
        const projected = base + g.dx;
        if (-projected >= FULL_SWIPE_THRESHOLD || g.vx < -1.2) {
          openCloser = null;
          fling();
          return;
        }
        const shouldOpen = projected < -ACTION_WIDTH / 2;
        if (shouldOpen && !isOpen.current) {
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
  // Red fills the whole track so a full swipe reveals red edge-to-edge, while
  // a short swipe just shows the 84px "Remove" zone at the right.
  actionLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: colors.down,
  },
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
