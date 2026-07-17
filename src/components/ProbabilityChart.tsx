import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Text, View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing } from '@/theme';
import type { MarketSnapshot } from '@/types';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const PAD_X = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 22; // room for date axis labels

/** Catmull-Rom → cubic bezier: smooth curve through every point, no overshoot drama. */
function smoothPath(pts: Array<readonly [number, number]>): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function ProbabilityChart({
  data,
  width,
  height = 180,
  up = true,
}: {
  data: MarketSnapshot[];
  width: number;
  height?: number;
  up?: boolean;
}) {
  const [scrub, setScrub] = useState<number | null>(null);

  const geom = useMemo(() => {
    if (data.length < 2) return null;
    const probs = data.map((d) => d.probability);
    const min = Math.min(...probs);
    const max = Math.max(...probs);
    const range = Math.max(max - min, 0.02);
    const innerW = width - PAD_X * 2;
    const innerH = height - PAD_TOP - PAD_BOTTOM;
    const pts = data.map((d, i) => {
      const x = PAD_X + (i / (data.length - 1)) * innerW;
      const y = PAD_TOP + (1 - (d.probability - min) / range) * innerH;
      return [x, y] as const;
    });
    // Approximate curve length for the draw-in animation.
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return { pts, min, max, innerW, len: len * 1.08 };
  }, [data, width, height]);

  // Draw-in: dash offset sweeps the line left → right; fill fades in after.
  const dash = useRef(new Animated.Value(0)).current;
  const fillOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!geom) return;
    dash.setValue(geom.len);
    fillOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(dash, {
        toValue: 0,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // SVG props aren't native-driver animatable
      }),
      Animated.timing(fillOpacity, { toValue: 1, duration: 350, useNativeDriver: false }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geom?.len]);

  // The pan responder is created once, so it must read live values through a
  // ref — capturing `geom`/`data` directly would freeze the first (empty)
  // render's values and the scrub would never respond.
  const live = useRef({ innerW: 0, count: 0 });
  useEffect(() => {
    live.current = { innerW: geom?.innerW ?? 0, count: data.length };
  }, [geom, data.length]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Don't let the parent ScrollView steal the gesture mid-scrub.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => locate(e.nativeEvent.locationX),
      onPanResponderMove: (e) => locate(e.nativeEvent.locationX),
      onPanResponderRelease: () => setScrub(null),
      onPanResponderTerminate: () => setScrub(null),
    }),
  ).current;

  const lastIdx = useRef<number | null>(null);
  function locate(x: number) {
    const { innerW, count } = live.current;
    if (innerW <= 0 || count < 2) return;
    const t = (x - PAD_X) / innerW;
    const idx = Math.min(count - 1, Math.max(0, Math.round(t * (count - 1))));
    if (idx !== lastIdx.current) {
      lastIdx.current = idx;
      void Haptics.selectionAsync(); // subtle tick as the crosshair steps
    }
    setScrub(idx);
  }

  if (!geom) return <View style={{ width, height }} />;

  const { pts, min, max } = geom;
  const stroke = up ? colors.up : colors.down;
  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${height - PAD_BOTTOM} L ${PAD_X} ${height - PAD_BOTTOM} Z`;
  const [endX, endY] = pts[pts.length - 1];

  const active = scrub != null ? data[scrub] : null;
  const activePt = scrub != null ? pts[scrub] : null;

  // Tooltip position, clamped inside the chart.
  const tipW = 150;
  const tipX = activePt ? Math.min(width - tipW - 4, Math.max(4, activePt[0] - tipW / 2)) : 0;

  return (
    <View style={{ width, height }} {...pan.panHandlers}>
      <Svg width={width} height={height} pointerEvents="none">
        <Defs>
          <LinearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity={0.24} />
            <Stop offset="1" stopColor={stroke} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <AnimatedPath d={area} fill="url(#chartFill)" opacity={fillOpacity} />
        <AnimatedPath
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={`${geom.len} ${geom.len}`}
          strokeDashoffset={dash}
        />
        {!active && <Circle cx={endX} cy={endY} r={4} fill={stroke} />}
        {activePt && (
          <>
            <Line
              x1={activePt[0]}
              y1={PAD_TOP - 4}
              x2={activePt[0]}
              y2={height - PAD_BOTTOM}
              stroke={colors.textMuted}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <Circle cx={activePt[0]} cy={activePt[1]} r={6} fill={colors.bg} stroke={stroke} strokeWidth={2.5} />
          </>
        )}
      </Svg>

      {/* range labels */}
      <Text style={[styles.rangeLabel, { top: PAD_TOP - 8, right: PAD_X }]}>
        {Math.round(max * 100)}%
      </Text>
      <Text style={[styles.rangeLabel, { bottom: PAD_BOTTOM + 2, right: PAD_X }]}>
        {Math.round(min * 100)}%
      </Text>
      {/* date axis */}
      <Text style={[styles.axisLabel, { left: PAD_X, bottom: 2 }]}>
        {fmtDate(data[0].capturedAt)}
      </Text>
      <Text style={[styles.axisLabel, { right: PAD_X, bottom: 2 }]}>
        {fmtDate(data[data.length - 1].capturedAt)}
      </Text>

      {/* scrub tooltip */}
      {active && (
        <View style={[styles.tooltip, { left: tipX, width: tipW }]}>
          <Text style={[styles.tooltipProb, { color: stroke }]}>
            {Math.round(active.probability * 100)}%
          </Text>
          <Text style={styles.tooltipDate}>{fmtDateTime(active.capturedAt)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rangeLabel: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '600',
    color: colors.textFaint,
    fontVariant: ['tabular-nums'],
  },
  axisLabel: { position: 'absolute', fontSize: 10, color: colors.textFaint },
  tooltip: {
    position: 'absolute',
    top: 0,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  tooltipProb: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tooltipDate: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
});
