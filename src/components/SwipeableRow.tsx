import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radius, typography } from '@/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ACTION_WIDTH = 84;
const SCREEN_W = Dimensions.get('window').width;
// Past this drag distance, releasing removes the row outright (iOS Mail-style
// full swipe) instead of just resting on the Remove button.
const FULL_SWIPE_THRESHOLD = SCREEN_W * 0.5;
// Beyond the Remove button, add drag resistance so the row feels tethered
// rather than loose until you commit to the full swipe.
const RESISTANCE = 0.55;

/** Tracks which row is currently swiped open so opening a new one closes the last. */
let openCloser: (() => void) | null = null;

/** Collapse neighbours smoothly into the gap a removed row leaves behind. */
function animateRemoval(onRemove: () => void) {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
  );
  onRemove();
}

/**
 * Swipe-left row for the watchlist. Two gestures in one:
 *   • a short swipe rests on a red "Remove" button, and
 *   • a full swipe (past ~50% of the screen, or a fast flick) flings the row
 *     off and removes it - the fast path people expect from Mail/Reminders.
 * Built on PanResponder + Animated (no react-native-gesture-handler dep), the
 * same idiom the chart scrubber already uses in this codebase.
 */
export function SwipeableRow({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);
  const armed = useRef(false); // crossed the full-swipe threshold this gesture

  function settle(open: boolean) {
    isOpen.current = open;
    Animated.spring(translateX, {
      toValue: open ? -ACTION_WIDTH : 0,
      useNativeDriver: true,
      friction: 11,
      tension: 80,
    }).start();
  }

  function close() {
    if (isOpen.current) settle(false);
  }

  function fling() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Animated.timing(translateX, {
      toValue: -SCREEN_W,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => finished && animateRemoval(onRemove));
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
      onPanResponderGrant: () => {
        armed.current = false;
        if (openCloser && openCloser !== close) openCloser();
      },
      onPanResponderMove: (_, g) => {
        const base = isOpen.current ? -ACTION_WIDTH : 0;
        let dx = base + g.dx;
        // 1:1 until the Remove button is fully revealed, then resist so the
        // pull toward a full swipe feels deliberate.
        if (dx < -ACTION_WIDTH) dx = -ACTION_WIDTH + (dx + ACTION_WIDTH) * RESISTANCE;
        const next = Math.min(0, Math.max(-SCREEN_W, dx));
        translateX.setValue(next);
        // The visual position after resistance maps back to a real distance
        // for the threshold check.
        const travelled = next < -ACTION_WIDTH ? ACTION_WIDTH + (-next - ACTION_WIDTH) / RESISTANCE : -next;
        const crossed = travelled >= FULL_SWIPE_THRESHOLD;
        if (crossed && !armed.current) {
          armed.current = true;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); // "release to delete"
        } else if (!crossed && armed.current) {
          armed.current = false;
        }
      },
      onPanResponderRelease: (_, g) => {
        if (armed.current || g.vx < -1.1) {
          openCloser = null;
          fling();
          return;
        }
        const shouldOpen = (isOpen.current ? -ACTION_WIDTH : 0) + g.dx < -ACTION_WIDTH / 2;
        if (shouldOpen && !isOpen.current) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        settle(shouldOpen);
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
            animateRemoval(onRemove);
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
  actionText: { ...typography.ticker, fontSize: 9, color: '#fff' },
});
