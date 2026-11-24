import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, type Ref, useEffect, useState } from 'react';
import { Platform, StyleSheet, TextInput, type TextInputInstance, type TextInputProps, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  interpolate,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts, gradients, radius } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

const HEIGHT = 58;
const RING = 1.5;

type Props = Omit<TextInputProps, 'style' | 'placeholder' | 'onFocus' | 'onBlur' | 'value' | 'onChangeText'> & {
  label: string;
  icon: IconName;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  /** Content on the right edge, for example a show/hide button. */
  trailing?: ReactNode;
  onFocusChange?: (focused: boolean) => void;
  ref?: Ref<TextInputInstance>;
};

/**
 * A text field with a floating label. On focus the border lights up with the brand gradient and a soft halo;
 * on error it turns red. The label doubles as the accessible name.
 */
export function GlowField({ label, icon, value, onChangeText, error, trailing, onFocusChange, ref, editable = true, ...inputProps }: Props) {
  const reduce = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);
  const floated = focused || value.length > 0;

  const focus = useSharedValue(0);
  const lift = useSharedValue(0);

  useEffect(() => {
    focus.set(withTiming(focused ? 1 : 0, { duration: reduce ? 0 : 240, easing: Easing.out(Easing.cubic) }));
  }, [focused, reduce, focus]);

  useEffect(() => {
    lift.set(withTiming(floated ? 1 : 0, { duration: reduce ? 0 : 200, easing: Easing.out(Easing.cubic) }));
  }, [floated, reduce, lift]);

  const haloStyle = useAnimatedStyle(() => ({ opacity: hasError ? 0 : focus.value }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: hasError ? 1 : focus.value }));
  const hairlineStyle = useAnimatedStyle(() => ({ opacity: hasError ? 0 : 1 - focus.value }));
  const labelStyle = useAnimatedStyle(() => ({
    color: hasError ? colors.danger : interpolateColor(focus.value, [0, 1], [colors.textSubtle, colors.aqua]),
    transform: [{ translateY: interpolate(lift.value, [0, 1], [0, -11]) }, { scale: interpolate(lift.value, [0, 1], [1, 0.76]) }],
  }));

  const ringColors = hasError ? ([colors.danger, colors.danger] as const) : gradients.brand;
  const iconColor = hasError ? colors.danger : focused ? colors.aqua : colors.textSubtle;

  return (
    <View>
      <View>
        <Animated.View style={[styles.halo, haloStyle]} />
        <View style={styles.box}>
          <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
            <LinearGradient colors={ringColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <View style={styles.surface}>
            <Icon name={icon} size={20} color={iconColor} />
            <View style={styles.inputWrap}>
              <Animated.Text numberOfLines={1} style={[styles.label, labelStyle]}>
                {label}
              </Animated.Text>
              <TextInput
                ref={ref}
                value={value}
                onChangeText={onChangeText}
                editable={editable}
                onFocus={() => {
                  setFocused(true);
                  onFocusChange?.(true);
                }}
                onBlur={() => {
                  setFocused(false);
                  onFocusChange?.(false);
                }}
                style={styles.input}
                cursorColor={colors.aqua}
                selectionColor={colors.aqua}
                accessibilityLabel={label}
                maxFontSizeMultiplier={1.3}
                {...inputProps}
              />
            </View>
            {trailing}
          </View>
          <Animated.View style={[styles.hairline, { borderColor: hasError ? colors.dangerLine : colors.line }, hairlineStyle]} />
        </View>
      </View>
      {error ? (
        <Animated.View
          entering={FadeInDown.duration(180).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(120).reduceMotion(ReduceMotion.System)}
          accessibilityLiveRegion="polite">
          <AppText variant="caption" color={colors.danger} style={styles.error}>
            {error}
          </AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: radius.lg + 4,
    backgroundColor: colors.aquaSoft,
    pointerEvents: 'none',
  },
  box: {
    height: HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.field,
  },
  surface: {
    flex: 1,
    margin: RING,
    borderRadius: radius.lg - RING,
    backgroundColor: colors.field,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    gap: 12,
  },
  // The resting hairline border, drawn above everything and hidden while the ring is lit.
  hairline: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.lg,
    borderWidth: 1,
    pointerEvents: 'none',
  },
  inputWrap: { flex: 1, height: '100%', justifyContent: 'center' },
  label: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    transformOrigin: 'left center',
    pointerEvents: 'none',
  },
  input: {
    height: '100%',
    paddingTop: 19,
    paddingBottom: 4,
    paddingHorizontal: 0,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    backgroundColor: 'transparent',
    // The field draws its own focus ring, so hide the browser's default one (web previews only; phones have none).
    ...Platform.select({ web: { outlineStyle: 'none' } as object }),
    includeFontPadding: false,
  },
  error: { marginTop: 6, marginLeft: 4 },
});
