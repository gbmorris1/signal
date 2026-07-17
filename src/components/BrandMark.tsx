import Svg, { Path, Polygon, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '@/theme';

/**
 * ODDIQ brand mark, rebuilt as vector from the logo board: a hexagonal "O"
 * with an ascending arrow rising through it. Crisp at any size (the source
 * board only had a small raster). `mono` renders a single-color version for
 * headers/monochrome contexts.
 */
export function BrandMark({ size = 40, mono = false }: { size?: number; mono?: boolean }) {
  const navy = mono ? colors.text : '#0E1E45';
  const blue = mono ? colors.text : '#1E6FD9';
  const cyan = mono ? colors.text : '#22C9F5';

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Defs>
        <LinearGradient id="odq-arrow" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={blue} />
          <Stop offset="1" stopColor={cyan} />
        </LinearGradient>
      </Defs>

      {/* Hexagonal "O" — open on the right where the arrow passes through */}
      <Path
        d="M34 16 L14 28 L14 52 L34 64 L44 58 L26 48 L26 32 L44 22 Z"
        fill={navy}
      />

      {/* Ascending arrow shaft (three rising facets) */}
      <Polygon points="40,70 54,44 62,49 48,75" fill={navy} opacity={mono ? 1 : 0.9} />
      <Polygon points="52,60 66,34 74,39 60,65" fill="url(#odq-arrow)" />

      {/* Arrowhead */}
      <Polygon points="66,20 86,26 74,44 70,34 58,40" fill={cyan} />
    </Svg>
  );
}
