import { Text, type TextProps } from 'react-native';

import { colors, type TypeVariant, typography } from '@/theme';

type Props = TextProps & {
  variant?: TypeVariant;
  color?: string;
};

/** The app's only text component: a typography variant plus a colour. Font scaling is capped so layouts stay intact. */
export function AppText({ variant = 'body', color = colors.text, style, maxFontSizeMultiplier = 1.3, ...rest }: Props) {
  return <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[typography[variant], { color }, style]} {...rest} />;
}
