import { View } from 'react-native';
import Svg, { Polyline, Polygon, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '@/theme';
import type { MarketSnapshot } from '@/types';

export function Sparkline({
  data,
  width = 320,
  height = 120,
  up = true,
}: {
  data: MarketSnapshot[];
  width?: number;
  height?: number;
  up?: boolean;
}) {
  if (data.length < 2) return <View style={{ width, height }} />;

  const probs = data.map((d) => d.probability);
  const min = Math.min(...probs);
  const max = Math.max(...probs);
  const range = max - min || 0.02; // avoid a flat line hugging the edge
  const pad = 8;

  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (d.probability - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${pad},${height} ${line} ${(width - pad).toFixed(1)},${height}`;
  const [lastX, lastY] = pts[pts.length - 1];
  const stroke = up ? colors.up : colors.down;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity={0.22} />
          <Stop offset="1" stopColor={stroke} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Polygon points={area} fill="url(#fill)" />
      <Polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle cx={lastX} cy={lastY} r={3.5} fill={stroke} />
    </Svg>
  );
}
