import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { colors, gradients, radius } from '@/theme';
import { haptic } from '@/utils/haptics';

import { AppText } from './AppText';
import { BrandLoader } from './BrandLoader';
import { Icon, type IconName } from './Icon';

const HEIGHT = 56;

/**
 * `primary` is the brand gradient, `ghost` an outline for secondary actions,
 * `danger` a red outline (starts a delete), `dangerSolid` filled red (confirms a delete).
 */
type Variant = 'primary' | 'ghost' | 'danger' | 'dangerSolid';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  variant?: Variant;
  icon?: IconName;
  iconPosition?: 'start' | 'end';
};

export function GradientButton({
  label,
  onPress,
  loading = false,
  loadingLabel,
  disabled = false,
  variant = 'primary',
  icon,
  iconPosition = 'end',
}: Props) {
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const press = useSharedValue(0);
  const sheen = useSharedValue(0);
  const primary = variant === 'primary';
  const inactive = disabled || loading;

  // A soft diagonal glint crosses the button every few seconds to say "ready"; it stops while busy or when motion is reduced.
  useEffect(() => {
    if (reduce || !primary || inactive) {
      cancelAnimation(sheen);
      sheen.set(0);
      return;
    }
    sheen.set(
      withDelay(
        2400,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
            withTiming(0, { duration: 0 }),
            withDelay(5200, withTiming(0, { duration: 0 })),
          ),
          -1,
        ),
      ),
    );
    return () => cancelAnimation(sheen);
  }, [reduce, primary, inactive, sheen]);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.025 * press.value }] }));
  const shadeStyle = useAnimatedStyle(() => ({ opacity: 0.14 * press.value }));
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheen.value, [0, 0.12, 0.88, 1], [0, 0.55, 0.55, 0]),
    transform: [{ translateX: interpolate(sheen.value, [0, 1], [-90, width + 30]) }, { skewX: '-20deg' }],
  }));

  const textColor = primary || variant === 'dangerSolid' ? colors.onBrand : variant === 'danger' ? colors.danger : colors.text;
  const shownLabel = loading && loadingLabel ? loadingLabel : label;

  function handlePress() {
    if (inactive) return;
    haptic.tap();
    onPress();
  }

  return (
    <View style={styles.wrap} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {primary && !disabled ? (
        <View style={styles.spill}>
          <Svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="spill" cx="50" cy="20" rx="50" ry="20" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={colors.aqua} stopOpacity={0.34} />
                <Stop offset="1" stopColor={colors.aqua} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx="50" cy="20" rx="50" ry="20" fill="url(#spill)" />
          </Svg>
        </View>
      ) : null}

      <Animated.View style={[pressStyle, disabled && !loading && styles.disabled]}>
        <Pressable
          onPress={handlePress}
          onPressIn={() => press.set(withTiming(1, { duration: 90 }))}
          onPressOut={() => press.set(withTiming(0, { duration: 160 }))}
          accessibilityRole="button"
          accessibilityLabel={shownLabel}
          accessibilityState={{ disabled: inactive, busy: loading }}
          style={[
            styles.button,
            variant === 'ghost' && styles.ghost,
            variant === 'danger' && styles.dangerOutline,
            variant === 'dangerSolid' && styles.dangerFill,
          ]}>
          {primary ? (
            <LinearGradient colors={gradients.brand} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />
          ) : null}
          <Animated.View style={[StyleSheet.absoluteFill, styles.shade, shadeStyle]} />
          {primary ? (
            <Animated.View style={[styles.sheen, sheenStyle]}>
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          ) : null}
          <View style={styles.content}>
            {loading ? <BrandLoader size={22} color={textColor} /> : null}
            {icon && !loading && iconPosition === 'start' ? <Icon name={icon} size={20} color={textColor} strokeWidth={2} /> : null}
            <AppText variant="button" color={textColor}>
              {shownLabel}
            </AppText>
            {icon && !loading && iconPosition === 'end' ? <Icon name={icon} size={20} color={textColor} strokeWidth={2} /> : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  // Light spilling under the button, so it reads as glowing rather than flat.
  spill: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: -18,
    height: 44,
    pointerEvents: 'none',
  },
  button: {
    height: HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: { borderWidth: 1, borderColor: colors.lineStrong },
  dangerOutline: { borderWidth: 1, borderColor: colors.dangerLine, backgroundColor: colors.dangerSoft },
  dangerFill: { backgroundColor: colors.danger },
  shade: { backgroundColor: '#000000' },
  sheen: { position: 'absolute', top: -10, bottom: -10, width: 54, pointerEvents: 'none' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  disabled: { opacity: 0.5 },
});
