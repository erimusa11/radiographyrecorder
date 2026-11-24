import { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors } from '@/theme';

import { LOGO_HEIGHT, LOGO_WIDTH, LUNGS_PATH, RING_PATH } from './logoPaths';

/** Height / width of the mark. */
export const MARK_RATIO = LOGO_HEIGHT / LOGO_WIDTH;

type Props = {
  /** Rendered width in dp; the height follows the logo's proportions. */
  width: number;
  /**
   * `lit`: the brand gradient (aqua at the top to azure at the base, as in the logo).
   * `ghost`: the unlit outline, like a film before it is exposed.
   * `solid`: one flat colour.
   */
  variant?: 'lit' | 'ghost' | 'solid';
  /** Colour for the `solid` variant. */
  color?: string;
};

/**
 * The Radiography Recorder mark (lungs and orbit ring), drawn from the logo's own vectors.
 * It carries no accessibility props: the caller decides (BrandHero hides it as decoration; a logo used on its own
 * should be wrapped in an accessible View with a label such as "Radiography Recorder").
 */
export function LungMark({ width, variant = 'lit', color = colors.text }: Props) {
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const scale = width / LOGO_WIDTH;
  const ghost = variant === 'ghost';
  const fill = variant === 'lit' ? `url(#${gradientId})` : variant === 'solid' ? color : colors.aqua;

  return (
    <Svg width={width} height={width * MARK_RATIO} viewBox={`0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}`}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2={LOGO_HEIGHT} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.aqua} />
          <Stop offset="1" stopColor={colors.azure} />
        </LinearGradient>
      </Defs>
      {[LUNGS_PATH, RING_PATH].map((d, index) => (
        <Path
          key={index}
          d={d}
          fill={fill}
          fillOpacity={ghost ? 0.06 : 1}
          fillRule="evenodd"
          stroke={ghost ? colors.aqua : undefined}
          strokeOpacity={ghost ? 0.5 : undefined}
          strokeWidth={ghost ? 1.1 / scale : undefined}
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
