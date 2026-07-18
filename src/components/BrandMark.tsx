import Svg, { Path, Polygon, Polyline, Circle } from 'react-native-svg';
import { colors } from '@/theme';

/**
 * ODDIQ brand mark — a hexagonal "O" with a stock-chart arrow trending up
 * through it, rebuilt as vector to match the logo. Crisp at any size and
 * transparent, so it sits on any surface. `mono` collapses it to one color
 * for monochrome contexts (e.g. a header tint).
 */
export function BrandMark({ size = 40, mono = false }: { size?: number; mono?: boolean }) {
  const ring = mono ? colors.text : '#2A3E6E';
  const facet = mono ? colors.text : '#22C9F5';
  const back = mono ? colors.text : '#1E2A5C';
  const mid = mono ? colors.text : '#1E6FD9';
  const front = mono ? colors.text : '#22C9F5';
  const node = mono ? colors.text : '#E8FBFF';

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Hexagonal "O" ring */}
      <Path
        fillRule="evenodd"
        d="M30,76 L9.2,64 L9.2,40 L30,28 L50.8,40 L50.8,64 Z M30,65 L18.7,58.5 L18.7,45.5 L30,39 L41.3,45.5 L41.3,58.5 Z"
        fill={ring}
      />
      {/* Cyan lower-left facet */}
      <Polygon points="9.2,64 30,76 30,65 18.7,58.5" fill={facet} />
      {/* Ascending ribbons: navy shadow, blue, cyan front */}
      <Polyline
        points="34,66 48,52 57,60 73,39"
        fill="none"
        stroke={back}
        strokeWidth={6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Polyline
        points="34,63 48,49 57,57 73,36"
        fill="none"
        stroke={mid}
        strokeWidth={6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Polyline
        points="34,60 48,46 57,54 71,33"
        fill="none"
        stroke={front}
        strokeWidth={6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Arrowhead */}
      <Polygon points="83,22 66,25 75,40" fill={front} />
      {/* Data node */}
      <Circle cx="48" cy="46" r="3.6" fill={node} />
    </Svg>
  );
}
