import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@/theme';

/**
 * The room every screen sits in: the logo's ink, a faint measurement grid that fades out downward, and two
 * ambient lights (aqua from above, azure from the lower corner), like a dark reading room around a light-box.
 */
function Backdrop() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <Pattern id="rr-grid" width={24} height={24} patternUnits="userSpaceOnUse">
          <Circle cx={12} cy={12} r={1} fill="#FFFFFF" fillOpacity={0.09} />
        </Pattern>
        <LinearGradient id="rr-grid-fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.ink} stopOpacity={0} />
          <Stop offset="0.6" stopColor={colors.ink} stopOpacity={1} />
        </LinearGradient>
        <RadialGradient id="rr-aqua" cx="50%" cy="0%" rx="90%" ry="46%" fx="50%" fy="0%">
          <Stop offset="0" stopColor={colors.aqua} stopOpacity={0.15} />
          <Stop offset="1" stopColor={colors.aqua} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="rr-azure" cx="100%" cy="100%" rx="95%" ry="42%" fx="100%" fy="100%">
          <Stop offset="0" stopColor={colors.azure} stopOpacity={0.12} />
          <Stop offset="1" stopColor={colors.azure} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={colors.ink} />
      <Rect width="100%" height="100%" fill="url(#rr-grid)" />
      <Rect width="100%" height="100%" fill="url(#rr-grid-fade)" />
      <Rect width="100%" height="100%" fill="url(#rr-aqua)" />
      <Rect width="100%" height="100%" fill="url(#rr-azure)" />
    </Svg>
  );
}

/**
 * Base layout for every screen: the backdrop plus safe-area padding for notches and system bars.
 * `bottomInset={false}` lets a bottom bar (the tab bar) reach the very bottom and handle that space itself.
 */
export function Screen({ children, style, bottomInset = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; bottomInset?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: bottomInset ? insets.bottom : 0, paddingLeft: insets.left, paddingRight: insets.right },
        style,
      ]}>
      <Backdrop />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
});
