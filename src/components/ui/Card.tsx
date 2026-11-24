import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, space } from '@/theme';

/**
 * A panel for forms and content: a faint lifted surface with a hairline border and a thin
 * aqua "edge light" along the top, like the rim of a light-box.
 */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]}>
      <LinearGradient
        colors={['rgba(67,213,209,0)', 'rgba(67,213,209,0.7)', 'rgba(33,178,232,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.edge}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space.xl,
    gap: space.lg,
  },
  edge: {
    position: 'absolute',
    top: -1,
    left: 32,
    right: 32,
    height: 1.5,
    pointerEvents: 'none',
  },
});
