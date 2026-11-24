import { type ReactNode, type Ref, useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, type TextInputInstance, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { strings } from '@/constants/strings';
import { colors, MIN_TARGET, radius } from '@/theme';
import { cleanText, foldText } from '@/utils/text';

import { AppText } from './AppText';
import { GlowField } from './GlowField';
import { Icon, type IconName } from './Icon';

const { record } = strings;
const ROW_HEIGHT = 48;

// On the web the field loses focus the moment the mouse goes down on a row, which could close the list before the click
// lands, so rows react on press-in there (and on the normal click too, because a very fast tap skips press-in).
// On phones they react on release only, so scrolling the list never picks one by accident.
const web = Platform.OS === 'web';

type Props = {
  label: string;
  icon: IconName;
  value: string;
  onChangeText: (text: string) => void;
  /** The saved values to choose from. */
  options: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the screen where saved values are added, renamed and deleted. */
  onManage: () => void;
  /** Called after a value was picked from the list, for example to jump to the next field. */
  onChosen?: () => void;
  error?: string | null;
  /** Shown just before the arrow, for example an "opsionale" tag. */
  extra?: ReactNode;
  onFocusChange?: (focused: boolean) => void;
  ref?: Ref<TextInputInstance>;
};

/**
 * One box that is both an input and a select. Type to filter the saved values or to write a new one,
 * or tap the arrow to see the whole list. A value that is not in the list yet is offered as "Shto ..." and is
 * remembered for next time when the record is saved.
 */
export function ComboField({
  label,
  icon,
  value,
  onChangeText,
  options,
  open,
  onOpenChange,
  onManage,
  onChosen,
  error,
  extra,
  onFocusChange,
  ref,
}: Props) {
  const { height } = useWindowDimensions();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreBlurUntil = useRef(0);
  const handledAt = useRef(0);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const typed = cleanText(value);
  const query = foldText(value);
  const exact = options.find((item) => foldText(item) === query);
  const isNew = query.length > 0 && !exact;
  // While the text is not a saved value, narrow the list as the person types; once it matches, show everything again.
  const shown = !query || exact ? options : options.filter((item) => foldText(item).includes(query));
  const maxHeight = Math.min(ROW_HEIGHT * 5, Math.round(height * 0.3));

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  /** Runs an action once per tap, even though the web can report the same tap twice (press-in and click). */
  function once(action: () => void) {
    const now = Date.now();
    if (now - handledAt.current < 500) return;
    handledAt.current = now;
    action();
  }

  function handleFocus(focused: boolean) {
    onFocusChange?.(focused);
    cancelClose();
    if (focused) {
      onOpenChange(true);
      return;
    }
    closeTimer.current = setTimeout(() => {
      if (Date.now() >= ignoreBlurUntil.current) onOpenChange(false);
    }, 180);
  }

  function handleType(text: string) {
    onChangeText(text);
    if (!open) onOpenChange(true);
  }

  function choose(text: string) {
    cancelClose();
    onChangeText(text);
    onOpenChange(false);
    onChosen?.();
  }

  function toggle() {
    cancelClose();
    ignoreBlurUntil.current = Date.now() + 500;
    onOpenChange(!open);
  }

  function manage() {
    cancelClose();
    onOpenChange(false);
    onManage();
  }

  const chevron = (
    <Pressable
      onPress={() => once(toggle)}
      onPressIn={web ? () => once(toggle) : undefined}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={open ? record.hideList : record.showList}
      style={styles.chevron}>
      <Icon name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.textMuted} />
    </Pressable>
  );

  return (
    <View>
      <GlowField
        ref={ref}
        label={label}
        icon={icon}
        value={value}
        onChangeText={handleType}
        error={error}
        trailing={
          <View style={styles.trailing}>
            {extra}
            {chevron}
          </View>
        }
        onFocusChange={handleFocus}
        autoCapitalize="sentences"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        importantForAutofill="no"
        textContentType="none"
        returnKeyType="done"
        onSubmitEditing={() => (typed ? choose(typed) : onOpenChange(false))}
      />

      {open ? (
        <Animated.View
          entering={FadeInDown.duration(150).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(90).reduceMotion(ReduceMotion.System)}
          style={styles.panel}>
          <ScrollView style={{ maxHeight }} nestedScrollEnabled keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={shown.length > 5}>
            {isNew ? (
              <Pressable
                onPress={() => once(() => choose(typed))}
                onPressIn={web ? () => once(() => choose(typed)) : undefined}
                accessibilityRole="button"
                accessibilityLabel={record.comboAdd(typed)}
                style={styles.row}>
                <Icon name="plus" size={18} color={colors.aqua} />
                <AppText variant="bodyStrong" color={colors.aqua} numberOfLines={1} style={styles.rowText}>
                  {record.comboAdd(typed)}
                </AppText>
              </Pressable>
            ) : null}
            {shown.map((item) => (
              <Pressable
                key={item}
                onPress={() => once(() => choose(item))}
                onPressIn={web ? () => once(() => choose(item)) : undefined}
                accessibilityRole="button"
                accessibilityState={{ selected: item === exact }}
                style={[styles.row, item === exact && styles.rowSelected]}>
                <AppText variant="body" numberOfLines={1} style={styles.rowText}>
                  {item}
                </AppText>
                {item === exact ? <Icon name="check" size={18} color={colors.aqua} /> : null}
              </Pressable>
            ))}
            {shown.length === 0 && !isNew ? (
              <AppText variant="caption" color={colors.textSubtle} style={styles.empty}>
                {record.comboEmpty}
              </AppText>
            ) : null}
          </ScrollView>
          <Pressable
            onPress={() => once(manage)}
            onPressIn={web ? () => once(manage) : undefined}
            accessibilityRole="button"
            accessibilityLabel={record.manage}
            style={styles.manage}>
            <Icon name="pencil" size={16} color={colors.aqua} />
            <AppText variant="label" color={colors.aqua}>
              {record.manage}
            </AppText>
          </Pressable>
        </Animated.View>
      ) : null}

      {!open && !error ? (
        !value.trim() ? (
          <AppText variant="caption" color={colors.textSubtle} style={styles.hint}>
            {record.comboHint}
          </AppText>
        ) : isNew ? (
          <AppText variant="caption" color={colors.aqua} style={styles.hint}>
            {record.comboNew}
          </AppText>
        ) : null
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trailing: { flexDirection: 'row', alignItems: 'center' },
  chevron: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  panel: {
    marginTop: 8,
    backgroundColor: '#2A2B2C',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    overflow: 'hidden',
  },
  row: { minHeight: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  rowSelected: { backgroundColor: colors.aquaSoft },
  rowText: { flex: 1 },
  empty: { padding: 16 },
  manage: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  hint: { marginTop: 6, marginLeft: 4 },
});
