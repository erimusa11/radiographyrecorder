import { Pressable, StyleSheet, View } from 'react-native';

import { colors, MIN_TARGET } from '@/theme';
import { haptic } from '@/utils/haptics';

import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

const BOX = 22;

/** A labelled checkbox. The whole row is the touch target (36 high plus 6 of hit slop above and below = 48). */
export function Checkbox({ label, checked, onChange, disabled = false }: Props) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onChange(!checked);
      }}
      disabled={disabled}
      hitSlop={{ top: (MIN_TARGET - 36) / 2, bottom: (MIN_TARGET - 36) / 2, left: 6, right: 12 }}
      role="checkbox"
      aria-label={label}
      aria-checked={checked}
      aria-disabled={disabled}
      style={[styles.row, disabled && styles.disabled]}>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Icon name="check" size={15} color={colors.onBrand} strokeWidth={2.75} /> : null}
      </View>
      <AppText variant="label" color={colors.textMuted}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  box: {
    width: BOX,
    height: BOX,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.aqua, borderColor: colors.aqua },
  disabled: { opacity: 0.55 },
});
