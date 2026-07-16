import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Count-up number. Eases from 0 (or the previous value) to `value` with an
 * ease-out cubic — the terminal "numbers landing" feel. Format controls the
 * rendered string ("43%", "+8%", "1,204").
 */
export function AnimatedNumber({
  value,
  format = (v) => String(Math.round(v)),
  duration = 700,
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

  return <Text style={style}>{display}</Text>;
}

/**
 * Fade + rise entrance. Wrap list items and pass their index for a stagger.
 * Animates once on mount only.
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
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    const delay = Math.min(index, 8) * 55;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 380,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
