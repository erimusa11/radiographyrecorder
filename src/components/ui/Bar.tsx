import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, gradients } from '@/theme';

import { AppText } from './AppText';

type BarProps = {
  /** 0 to 1: how much of the track is filled. */
  ratio: number;
  height?: number;
  /** A softer fill, for secondary information. */
  muted?: boolean;
};

/** A rounded track with a brand-gradient fill that grows in when it appears. */
export function Bar({ ratio, height = 8, muted = false }: BarProps) {
  const reduce = useReducedMotion();
  const target = Math.min(1, Math.max(0, ratio));
  const fill = useSharedValue(reduce ? target : 0);

  useEffect(() => {
    fill.set(withTiming(target, { duration: reduce ? 0 : 650, easing: Easing.out(Easing.cubic) }));
  }, [target, reduce, fill]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <Animated.View style={[styles.fill, { borderRadius: height / 2 }, fillStyle, muted && styles.muted]}>
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

type RowProps = {
  label: string;
  value: number;
  /** The biggest value in the group; the bar is drawn relative to it. */
  max: number;
};

/** One line of a ranking: the name, the number, and a bar under them. */
export function BarRow({ label, value, max }: RowProps) {
  const ratio = max > 0 ? value / max : 0;
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.top}>
        <AppText variant="body" numberOfLines={1} style={styles.label}>
          {label}
        </AppText>
        <AppText variant="bodyStrong" color={value > 0 ? colors.aqua : colors.textSubtle}>
          {value}
        </AppText>
      </View>
      <Bar ratio={value > 0 ? Math.max(ratio, 0.04) : 0} height={6} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  fill: { height: '100%', overflow: 'hidden' },
  muted: { opacity: 0.55 },
  row: { gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { flex: 1 },
});
