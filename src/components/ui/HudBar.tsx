import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { strings } from '@/constants/strings';
import { colors, fonts } from '@/theme';

import { AppText } from './AppText';

/**
 * A radiograph viewer's corner markers. In a standard chest film the lead marker "R" sits on the left of the image
 * (the patient's right) and "L" on the right, so the screen is framed the way a radiographer reads a film.
 */
function LeadMarker({ letter }: { letter: 'R' | 'L' }) {
  return (
    <View style={styles.marker}>
      <AppText variant="label" color={colors.aqua} style={styles.markerText}>
        {letter}
      </AppText>
    </View>
  );
}

/** The slim overlay at the top of a screen: lead markers either side and a live "secure access" indicator. */
export function HudBar() {
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduce) return;
    const ease = Easing.inOut(Easing.sin);
    pulse.set(withRepeat(withSequence(withTiming(0.3, { duration: 900, easing: ease }), withTiming(1, { duration: 900, easing: ease })), -1));
    return () => cancelAnimation(pulse);
  }, [reduce, pulse]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LeadMarker letter="R" />
      <View style={styles.status}>
        <Animated.View style={[styles.dot, dotStyle]} />
        <AppText variant="hud" color={colors.textSubtle}>
          {strings.hud.access}
        </AppText>
      </View>
      <LeadMarker letter="L" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    height: 44,
  },
  marker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.aquaLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, includeFontPadding: false },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.aqua },
});
