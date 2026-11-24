import { useEffect } from 'react';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

/** A spinner drawn like the logo's orbit: a faint ring with one bright arc travelling around it. */
export function BrandLoader({ size = 22, color }: { size?: number; color: string }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.set(withRepeat(withTiming(360, { duration: 850, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(rotation);
  }, [rotation]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeOpacity={0.25} strokeWidth={2.6} />
        <Path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}
