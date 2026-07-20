import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { motion, typography } from '@/theme';

/**
 * One timing language for the whole app, driven by the theme's motion tokens:
 * everything enters on the same ease-out curve, at the same speed, with the
 * same stagger. That consistency is what makes motion read as choreography
 * rather than as a pile of individual effects.
 */
const EASE = Easing.bezier(...motion.easeOut);

/**
 * Count-up number. Eases to `value` — the terminal "numbers landing" feel.
 * Format controls the rendered string ("43%", "+8", "1,204").
 */
export function AnimatedNumber({
  value,
  format = (v) => String(Math.round(v)),
  duration = motion.base,
  style,
}: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  style?: StyleProp<TextStyle>;
}) {
  const [display, setDisplay] = useState(() => format(0));
  const from = useRef(0);

  useEffect(() => {
    const start = from.current;
    const delta = value - start;
    if (delta === 0) {
      setDisplay(format(value));
      return;
    }
    let raf = 0;
    const t0 = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(format(start + delta * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <Text style={[{ fontVariant: typography.stat.fontVariant }, style]}>{display}</Text>;
}

/**
 * Fade + rise entrance. Wrap list items and pass their index for a stagger.
 * Animates once on mount.
 */
export function Enter({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: motion.base,
      // Cap the stagger so a long list never feels like it's loading slowly.
      delay: Math.min(index, 8) * motion.stagger,
      easing: EASE,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <Animated.View style={[style, { opacity: t, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

/**
 * Screen-level entrance: one settling motion for a whole view, for places
 * where a staggered list would be wrong (detail screens, sheets).
 */
export function EnterScreen({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: motion.slow,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  }, [t]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return (
    <Animated.View style={[style, { opacity: t, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
