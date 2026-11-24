import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { colors, radius, space } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

export type BannerTone = 'error' | 'info';

/** An inline message: red for problems, aqua for good news. Screen readers hear it as soon as it appears. */
export function Banner({ tone, message }: { tone: BannerTone; message: string }) {
  const isError = tone === 'error';

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <Animated.View
      entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(140).reduceMotion(ReduceMotion.System)}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.box, isError ? styles.error : styles.info]}>
      <Icon name={isError ? 'alert' : 'check-circle'} size={18} color={isError ? colors.danger : colors.aqua} />
      <AppText variant="caption" color={isError ? colors.dangerText : colors.text} style={styles.text}>
        {message}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  error: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerLine },
  info: { backgroundColor: colors.aquaSoft, borderColor: colors.aquaLine },
  text: { flex: 1, marginTop: -1 },
});
