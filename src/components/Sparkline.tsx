import { View } from 'react-native';
import Svg, { Polyline, Line } from 'react-native-svg';
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
  const range = max - min || 1;
  const pad = 6;

  const points = data
    .map((d, i) => {
      const x = pad + (i / (data.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (d.probability - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const stroke = up ? colors.up : colors.down;

  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={colors.border} strokeWidth={1} />
      <Polyline points={points} fill="none" stroke={stroke} strokeWidth={2} />
    </Svg>
  );
}
