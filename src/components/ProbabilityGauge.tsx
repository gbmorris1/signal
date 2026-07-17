import { Text, View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme';

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(startDeg));
  const y1 = cy + r * Math.sin(rad(startDeg));
  const x2 = cx + r * Math.cos(rad(endDeg));
  const y2 = cy + r * Math.sin(rad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * Half-arc probability gauge (270° sweep from -135° to +135°). Reads like a
 * speedometer: needle position = current probability of the primary outcome.
 */
export function ProbabilityGauge({
  probability,
  size = 96,
  up = true,
}: {
  probability: number;
  size?: number;
  up?: boolean;
}) {
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const start = -135;
  const sweep = 270;
  const end = start + sweep * Math.min(0.999, Math.max(0.001, probability));
  const stroke = up ? colors.up : colors.down;

  return (
    <View style={{ width: size, height: size * 0.82, alignItems: 'center' }}>
      <Svg width={size} height={size * 0.82}>
        <Path
          d={arcPath(cx, cy, r, start, start + sweep)}
          stroke={colors.surfaceElevated}
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={arcPath(cx, cy, r, start, end)}
          stroke={stroke}
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFillObject, styles.center]}>
        <Text style={[styles.value, { color: stroke }]}>{Math.round(probability * 100)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 8 },
  value: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
});
