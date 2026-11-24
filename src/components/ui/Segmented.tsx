import { Pressable, StyleSheet, View } from 'react-native';

import { colors, MIN_TARGET, radius } from '@/theme';
import { haptic } from '@/utils/haptics';

import { AppText } from './AppText';

type Option<K extends string> = {
  key: K;
  label: string;
  /** A small count shown next to the label. Hidden when 0. */
  badge?: number;
};

type Props<K extends string> = {
  options: readonly Option<K>[];
  value: K;
  onChange: (key: K) => void;
};

/** A switch between a few views of one page, drawn as one rounded bar with the chosen part lit. */
export function Segmented<K extends string>({ options, value, onChange }: Props<K>) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => {
              if (selected) return;
              haptic.select();
              onChange(option.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.badge ? `${option.label}, ${option.badge}` : option.label}
            style={[styles.segment, selected && styles.segmentSelected]}>
            <AppText variant="label" color={selected ? colors.aqua : colors.textMuted} numberOfLines={2} style={styles.label}>
              {option.label}
            </AppText>
            {option.badge ? (
              <View style={[styles.badge, selected && styles.badgeSelected]}>
                <AppText variant="hud" color={selected ? colors.onBrand : colors.text} style={styles.badgeText}>
                  {option.badge > 99 ? '99+' : option.badge}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentSelected: { backgroundColor: colors.aquaSoft, borderColor: colors.aquaLine },
  label: { flexShrink: 1, textAlign: 'center' },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSelected: { backgroundColor: colors.aqua },
  badgeText: { letterSpacing: 0, lineHeight: 14, fontSize: 11 },
});
