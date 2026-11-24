import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { colors, motion } from '@/theme';

import { LOGO_WIDTH, ORBIT } from './logoPaths';
import { LungMark, MARK_RATIO } from './LungMark';

export type HeroStatus = 'idle' | 'loading' | 'success' | 'error';

type Props = {
  /** Width of the mark in dp. */
  markWidth: number;
  /** Layout height of the hero when the keyboard is closed. */
  height: number;
  /** Shrinks the hero to make room while the keyboard is open. */
  compact?: boolean;
  /** An input has focus: the lungs "inhale". */
  focused?: boolean;
  /** `loading` scans back and forth, `error` flushes the glow red, `success` flashes and sends out a ripple. */
  status?: HeroStatus;
};

const TWO_PI = Math.PI * 2;
const BEAM_HEIGHT = 34;
const COMPACT_SCALE = 0.62;
const BRACKET_PAD = 28;
/** The mark width the orbit-light sizes below were drawn for. */
const REFERENCE_WIDTH = 218;
const GLOW_BASE = 200;

const NO_TOUCH = { pointerEvents: 'none' } as const;

/** The orbiting light and its fading tail (angle behind the head, size at reference width, peak opacity). */
const TRAIL = [
  { lag: 0.32, size: 8, peak: 0.12 },
  { lag: 0.24, size: 11, peak: 0.22 },
  { lag: 0.16, size: 15, peak: 0.38 },
  { lag: 0.08, size: 20, peak: 0.6 },
  { lag: 0, size: 28, peak: 1 },
] as const;

function Glow({ tone }: { tone: 'brand' | 'danger' }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const brand = tone === 'brand';
  return (
    <Svg width={GLOW_BASE} height={GLOW_BASE} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={id} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={brand ? colors.aqua : colors.danger} stopOpacity={brand ? 0.36 : 0.42} />
          <Stop offset="0.45" stopColor={brand ? colors.azure : colors.danger} stopOpacity={brand ? 0.14 : 0.16} />
          <Stop offset="1" stopColor={brand ? colors.azure : colors.danger} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="50" fill={`url(#${id})`} />
    </Svg>
  );
}

/** Viewfinder corners, like the framing marks of a scanner. */
function Brackets({ width, height }: { width: number; height: number }) {
  const arm = 20;
  const r = 7;
  const d =
    `M0 ${arm}V${r}Q0 0 ${r} 0H${arm}` +
    `M${width - arm} 0H${width - r}Q${width} 0 ${width} ${r}V${arm}` +
    `M${width} ${height - arm}V${height - r}Q${width} ${height} ${width - r} ${height}H${width - arm}` +
    `M${arm} ${height}H${r}Q0 ${height} 0 ${height - r}V${height - arm}`;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={d} fill="none" stroke={colors.aqua} strokeOpacity={0.55} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function OrbitLight({
  side,
  lag,
  size,
  peak,
  phase,
  enter,
  scale,
}: {
  side: 'front' | 'back';
  lag: number;
  size: number;
  peak: number;
  phase: SharedValue<number>;
  enter: SharedValue<number>;
  scale: number;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');

  // The light rides the logo's own ring (an ellipse fitted to it). The lower half of the orbit is in front of the
  // lungs, the upper half behind them, so the light slips out of sight and peeks through between the lobes.
  const style = useAnimatedStyle(() => {
    const angle = phase.value - lag;
    const along = ORBIT.a * Math.cos(angle);
    const across = ORBIT.b * Math.sin(angle);
    const x = (ORBIT.cx + along * Math.cos(ORBIT.theta) - across * Math.sin(ORBIT.theta)) * scale;
    const y = (ORBIT.cy + along * Math.sin(ORBIT.theta) + across * Math.cos(ORBIT.theta)) * scale;
    const near = Math.sin(angle) >= 0;
    const visible = side === 'front' ? near : !near;
    return {
      opacity: visible ? peak * enter.value : 0,
      transform: [{ translateX: x - size / 2 }, { translateY: y - size / 2 }],
    };
  });

  return (
    <Animated.View style={[styles.light, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 10 10">
        <Defs>
          <RadialGradient id={id} cx="5" cy="5" r="5" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="0.22" stopColor="#D6FFFD" stopOpacity={0.95} />
            <Stop offset="0.55" stopColor={colors.aqua} stopOpacity={0.4} />
            <Stop offset="1" stopColor={colors.aqua} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="5" cy="5" r="5" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * The brand hero: the logo as a living film.
 *  1. On arrival a scan beam sweeps down and "exposes" the lungs, lit in the logo's gradient.
 *  2. Then they breathe, and a light travels around the orbit ring (behind the lungs on the far side).
 *  3. It reacts to the form: inhales on focus, scans while signing in, flushes red on error, ripples on success.
 * All motion stops for people who turned on "reduce motion"; the mark simply appears lit.
 */
export function BrandHero({ markWidth, height, compact = false, focused = false, status = 'idle' }: Props) {
  const reduce = useReducedMotion();
  const markHeight = markWidth * MARK_RATIO;
  const scale = markWidth / LOGO_WIDTH;
  const unit = markWidth / REFERENCE_WIDTH;
  const glowSize = markWidth * 1.9;
  const compactHeight = markHeight * COMPACT_SCALE + 40;

  const reveal = useSharedValue(reduce ? 1 : 0);
  const chrome = useSharedValue(reduce ? 1 : 0);
  // The orbit light only exists while motion is allowed: parked, it would look like a stray dot on the ring.
  const lights = useSharedValue(0);
  const breath = useSharedValue(0);
  const phase = useSharedValue(0);
  const inhale = useSharedValue(0);
  const compactAmount = useSharedValue(compact ? 1 : 0);
  const scanMix = useSharedValue(0);
  const scanLoop = useSharedValue(0);
  const flash = useSharedValue(0);
  const alarm = useSharedValue(0);
  const ripple = useSharedValue(0);

  // Arrival: frame and glow fade in, the beam scans the lungs lit, then the orbit light and the breathing begin.
  useEffect(() => {
    if (reduce) return;
    chrome.set(withTiming(1, { duration: 700 }));
    reveal.set(withDelay(motion.scanDelayMs, withTiming(1, { duration: motion.scanMs, easing: motion.inOut })));
    lights.set(withDelay(motion.scanDelayMs + motion.scanMs, withTiming(1, { duration: 700 })));
    phase.set(withDelay(1200, withRepeat(withTiming(TWO_PI, { duration: motion.orbitMs, easing: motion.linear }), -1, false)));
    breath.set(
      withDelay(
        motion.scanDelayMs + motion.scanMs,
        withRepeat(withTiming(1, { duration: motion.breathHalfMs, easing: motion.breathe }), -1, true),
      ),
    );
    return () => {
      cancelAnimation(reveal);
      cancelAnimation(chrome);
      cancelAnimation(lights);
      cancelAnimation(phase);
      cancelAnimation(breath);
    };
  }, [reduce, reveal, chrome, lights, phase, breath]);

  useEffect(() => {
    inhale.set(withTiming(focused ? 1 : 0, { duration: reduce ? 0 : 520, easing: motion.out }));
  }, [focused, reduce, inhale]);

  useEffect(() => {
    compactAmount.set(withTiming(compact ? 1 : 0, { duration: reduce ? 0 : 320, easing: motion.out }));
  }, [compact, reduce, compactAmount]);

  // While signing in, the beam keeps scanning up and down over the finished mark.
  useEffect(() => {
    if (status !== 'loading' || reduce) return;
    const ease = Easing.inOut(Easing.quad);
    scanMix.set(withTiming(1, { duration: 200 }));
    scanLoop.set(0);
    scanLoop.set(withRepeat(withSequence(withTiming(1, { duration: 900, easing: ease }), withTiming(0, { duration: 900, easing: ease })), -1, false));
    return () => {
      cancelAnimation(scanLoop);
      scanMix.set(withTiming(0, { duration: 250 }));
    };
  }, [status, reduce, scanMix, scanLoop]);

  useEffect(() => {
    if (reduce) return;
    if (status === 'error') {
      alarm.set(withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 1100 })));
    } else if (status === 'success') {
      flash.set(withSequence(withTiming(1, { duration: 180 }), withTiming(0, { duration: 800 })));
      ripple.set(0);
      ripple.set(withTiming(1, { duration: 1000, easing: motion.out }));
    }
  }, [status, reduce, alarm, flash, ripple]);

  const containerStyle = useAnimatedStyle(() => ({
    height: interpolate(compactAmount.value, [0, 1], [height, compactHeight], Extrapolation.CLAMP),
  }));
  const stageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(compactAmount.value, [0, 1], [1, COMPACT_SCALE], Extrapolation.CLAMP) }],
  }));
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.026 * breath.value + 0.05 * inhale.value + 0.07 * flash.value }, { translateY: -2 * breath.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, chrome.value * (0.7 + 0.3 * breath.value + 0.3 * inhale.value)),
    transform: [{ scale: (glowSize / GLOW_BASE) * (0.94 + 0.07 * breath.value + 0.06 * inhale.value + 0.1 * flash.value) }],
  }));
  const alarmStyle = useAnimatedStyle(() => ({
    opacity: alarm.value * 0.9,
    transform: [{ scale: (glowSize / GLOW_BASE) * 0.95 }],
  }));
  const litStyle = useAnimatedStyle(() => ({ height: reveal.value * markHeight }));
  const beamStyle = useAnimatedStyle(() => {
    const intro = interpolate(reveal.value, [0, 0.04, 0.9, 1], [0, 1, 1, 0], Extrapolation.CLAMP);
    const position = reveal.value * (1 - scanMix.value) + scanLoop.value * scanMix.value;
    return {
      opacity: intro * (1 - scanMix.value) + 0.9 * scanMix.value,
      transform: [{ translateY: position * markHeight - BEAM_HEIGHT / 2 }],
    };
  });
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.value, [0, 0.15, 1], [0, 0.7, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(ripple.value, [0, 1], [0.7, 2], Extrapolation.CLAMP) }],
  }));

  const center = { left: (markWidth - GLOW_BASE) / 2, top: (markHeight - GLOW_BASE) / 2 };

  return (
    <Animated.View style={[styles.container, containerStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ width: markWidth, height: markHeight }, stageStyle]}>
        <Animated.View style={[styles.glow, center, NO_TOUCH, glowStyle]}>
          <Glow tone="brand" />
        </Animated.View>
        <Animated.View style={[styles.glow, center, NO_TOUCH, alarmStyle]}>
          <Glow tone="danger" />
        </Animated.View>

        <Animated.View
          style={[
            styles.brackets,
            NO_TOUCH,
            { left: -BRACKET_PAD, top: -BRACKET_PAD * 0.75, width: markWidth + BRACKET_PAD * 2, height: markHeight + BRACKET_PAD * 1.5 },
            chromeStyle,
          ]}>
          <Brackets width={markWidth + BRACKET_PAD * 2} height={markHeight + BRACKET_PAD * 1.5} />
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, markStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, chromeStyle]}>
            <LungMark width={markWidth} variant="ghost" />
          </Animated.View>

          {TRAIL.map((t) => (
            <OrbitLight key={`back-${t.lag}`} side="back" lag={t.lag} size={t.size * unit} peak={t.peak} phase={phase} enter={lights} scale={scale} />
          ))}

          <Animated.View style={[styles.lit, { width: markWidth }, litStyle]}>
            {/* Fixed-size wrapper, out of the flex flow, so the clipped container can never squash the mark. */}
            <View style={[styles.litMark, { width: markWidth, height: markHeight }]}>
              <LungMark width={markWidth} variant="lit" />
            </View>
          </Animated.View>

          {TRAIL.map((t) => (
            <OrbitLight key={`front-${t.lag}`} side="front" lag={t.lag} size={t.size * unit} peak={t.peak} phase={phase} enter={lights} scale={scale} />
          ))}

          <Animated.View style={[styles.beam, NO_TOUCH, { left: -markWidth * 0.3, width: markWidth * 1.6 }, beamStyle]}>
            <LinearGradient
              colors={['rgba(67,213,209,0)', 'rgba(67,213,209,0.55)', '#EAFFFE', 'rgba(33,178,232,0.55)', 'rgba(33,178,232,0)']}
              locations={[0, 0.34, 0.5, 0.66, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[styles.ripple, NO_TOUCH, { left: markWidth * 0.05, top: markHeight * 0.1, width: markWidth * 0.9, height: markHeight * 0.8 }, rippleStyle]}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: GLOW_BASE, height: GLOW_BASE },
  brackets: { position: 'absolute' },
  lit: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
  litMark: { position: 'absolute', top: 0, left: 0 },
  beam: { position: 'absolute', top: 0, height: BEAM_HEIGHT },
  light: { position: 'absolute', top: 0, left: 0 },
  ripple: { position: 'absolute', borderRadius: 999, borderWidth: 1.5, borderColor: colors.aqua },
});
