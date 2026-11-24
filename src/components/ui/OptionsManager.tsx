import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '@/constants/strings';
import { colors, MIN_TARGET, radius, space } from '@/theme';
import { dataErrorMessage } from '@/utils/dataErrors';
import { haptic } from '@/utils/haptics';
import { cleanText, sameText, sortedUnique } from '@/utils/text';

import { AppText } from './AppText';
import { Banner } from './Banner';
import { GlowField } from './GlowField';
import { GradientButton } from './GradientButton';
import { Icon } from './Icon';

const { lists } = strings;

type Props = {
  /** The name of the list, for example "Lloji i filmit". */
  title: string;
  values: readonly string[];
  /** Saves the new list. Should throw if it could not be saved. */
  onChange: (next: string[]) => Promise<void>;
  onClose: () => void;
};

/**
 * A sheet for looking after the saved values of a type-or-choose field: add a value, rename one, or delete one.
 * Mount it only while it should be visible. Saved records keep the text they were saved with.
 */
export function OptionsManager({ title, values, onChange, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [newValue, setNewValue] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(next: string[]): Promise<boolean> {
    setBusy(true);
    try {
      await onChange(sortedUnique(next));
      setError(null);
      return true;
    } catch (e) {
      setError(dataErrorMessage(e));
      haptic.error();
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    const value = cleanText(newValue);
    if (!value || busy) return;
    if (values.some((item) => sameText(item, value))) {
      setError(lists.exists);
      return;
    }
    if (await apply([...values, value])) {
      setNewValue('');
      haptic.success();
    }
  }

  async function handleSaveEdit() {
    const value = cleanText(editValue);
    if (!value || editing === null || busy) return;
    if (values.some((item) => item !== editing && sameText(item, value))) {
      setError(lists.exists);
      return;
    }
    if (await apply(values.map((item) => (item === editing ? value : item)))) {
      setEditing(null);
      haptic.success();
    }
  }

  async function handleRemove() {
    if (removing === null || busy) return;
    if (await apply(values.filter((item) => item !== removing))) {
      setRemoving(null);
      haptic.success();
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={lists.close} />
        <View style={[styles.sheet, { paddingBottom: space.xl + insets.bottom }]} accessibilityViewIsModal>
          <View style={styles.header}>
            <AppText variant="heading" style={styles.headerText} numberOfLines={2}>
              {lists.title(title)}
            </AppText>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={lists.close} style={styles.iconButton}>
              <Icon name="x" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {error ? <Banner tone="error" message={error} /> : null}

          <GlowField
            label={lists.addLabel}
            icon="plus"
            value={newValue}
            onChangeText={(text) => {
              setNewValue(text);
              if (error) setError(null);
            }}
            editable={!busy}
            autoCapitalize="sentences"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            importantForAutofill="no"
            textContentType="none"
            returnKeyType="done"
            onSubmitEditing={handleAdd}
            trailing={
              <Pressable
                onPress={handleAdd}
                disabled={busy || !cleanText(newValue)}
                accessibilityRole="button"
                accessibilityLabel={lists.add}
                accessibilityState={{ disabled: busy || !cleanText(newValue) }}
                style={styles.iconButton}>
                <Icon name="check" size={22} color={cleanText(newValue) ? colors.aqua : colors.textSubtle} strokeWidth={2.2} />
              </Pressable>
            }
          />

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {values.length === 0 ? (
              <AppText variant="caption" color={colors.textSubtle} style={styles.empty}>
                {lists.empty}
              </AppText>
            ) : null}
            {values.map((item) => {
              if (editing === item) {
                return (
                  <View key={item} style={styles.editRow}>
                    <GlowField
                      label={lists.editLabel}
                      icon="pencil"
                      value={editValue}
                      onChangeText={(text) => {
                        setEditValue(text);
                        if (error) setError(null);
                      }}
                      editable={!busy}
                      autoCapitalize="sentences"
                      autoCorrect={false}
                      spellCheck={false}
                      autoComplete="off"
                      importantForAutofill="no"
                      textContentType="none"
                      returnKeyType="done"
                      onSubmitEditing={handleSaveEdit}
                    />
                    <View style={styles.pair}>
                      <View style={styles.pairItem}>
                        <GradientButton variant="ghost" label={lists.cancel} onPress={() => setEditing(null)} disabled={busy} />
                      </View>
                      <View style={styles.pairItem}>
                        <GradientButton label={lists.save} onPress={handleSaveEdit} loading={busy} />
                      </View>
                    </View>
                  </View>
                );
              }
              if (removing === item) {
                return (
                  <View key={item} style={styles.editRow}>
                    <AppText variant="body">{lists.confirmRemove(item)}</AppText>
                    <View style={styles.pair}>
                      <View style={styles.pairItem}>
                        <GradientButton variant="ghost" label={lists.cancel} onPress={() => setRemoving(null)} disabled={busy} />
                      </View>
                      <View style={styles.pairItem}>
                        <GradientButton variant="dangerSolid" label={lists.remove} onPress={handleRemove} loading={busy} />
                      </View>
                    </View>
                  </View>
                );
              }
              return (
                <View key={item} style={styles.row}>
                  <AppText variant="body" numberOfLines={1} style={styles.rowText}>
                    {item}
                  </AppText>
                  <Pressable
                    onPress={() => {
                      setEditing(item);
                      setEditValue(item);
                      setRemoving(null);
                      setError(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${lists.edit}: ${item}`}
                    style={styles.iconButton}>
                    <Icon name="pencil" size={19} color={colors.aqua} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setRemoving(item);
                      setEditing(null);
                      setError(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${lists.remove}: ${item}`}
                    style={styles.iconButton}>
                    <Icon name="trash" size={19} color={colors.danger} />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>

          <AppText variant="caption" color={colors.textSubtle}>
            {lists.note}
          </AppText>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#202122',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    padding: space.xl,
    gap: space.lg,
    maxHeight: '88%',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerText: { flex: 1 },
  iconButton: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 0, maxHeight: 300 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TARGET, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowText: { flex: 1 },
  editRow: { gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  pair: { flexDirection: 'row', gap: space.md },
  pairItem: { flex: 1 },
  empty: { paddingVertical: space.lg },
});
