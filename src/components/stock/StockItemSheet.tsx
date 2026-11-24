import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { GlowField } from '@/components/ui/GlowField';
import { GradientButton } from '@/components/ui/GradientButton';
import { Icon } from '@/components/ui/Icon';
import { strings } from '@/constants/strings';
import { useStock } from '@/context/StockContext';
import { colors, MIN_TARGET, radius, space } from '@/theme';
import type { StockFields, StockItem } from '@/types/stock';
import { dataErrorMessage } from '@/utils/dataErrors';
import { haptic } from '@/utils/haptics';
import { digitsOnly, parseQuantity } from '@/utils/stock';
import { cleanText, makeId, sameText } from '@/utils/text';

const { stockForm: form } = strings;

type Props = {
  /** The product being changed, or nothing for a new one. */
  existing?: StockItem;
  onSaved: (item: StockItem, isNew: boolean) => void;
  onDeleted: (item: StockItem) => void;
  onClose: () => void;
};

type Errors = { name?: string; quantity?: string; min?: string };

/**
 * A sheet for adding a product to the stock or changing one: name, how many there are, the unit and the minimum.
 * Mount it only while it should be visible.
 */
export function StockItemSheet({ existing, onSaved, onDeleted, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { stock, saveItem, removeItem } = useStock();

  const [name, setName] = useState(existing?.name ?? '');
  const [quantity, setQuantity] = useState(existing ? String(existing.quantity) : '');
  const [unit, setUnit] = useState(existing ? existing.unit : 'copë');
  const [minQuantity, setMinQuantity] = useState(existing && existing.minQuantity > 0 ? String(existing.minQuantity) : '');
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // A new product gets its id when the sheet opens and keeps it on retries, so a slow connection never makes it twice.
  const [draftId] = useState(makeId);

  function clear(key: keyof Errors) {
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    if (banner) setBanner(null);
  }

  /** Checks the form. Returns the cleaned values, or null after showing what is wrong. */
  function validate(): StockFields | null {
    const next: Errors = {};
    const cleanName = cleanText(name);
    if (!cleanName) next.name = form.nameRequired;
    else if (stock.some((item) => item.id !== existing?.id && sameText(item.name, cleanName))) next.name = form.nameExists;

    const amount = parseQuantity(quantity);
    if (amount === null) next.quantity = form.quantityInvalid;
    const minimum = minQuantity.trim() === '' ? 0 : parseQuantity(minQuantity);
    if (minimum === null) next.min = form.minInvalid;

    setErrors(next);
    if (next.name || next.quantity || next.min || amount === null || minimum === null) return null;
    return { name: cleanName, quantity: amount, unit: cleanText(unit), minQuantity: minimum };
  }

  async function handleSave() {
    if (busy) return;
    setBanner(null);
    const fields = validate();
    if (!fields) {
      haptic.error();
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      const saved = await saveItem({ fields, existing, draftId: existing ? undefined : draftId });
      haptic.success();
      onSaved(saved, !existing);
    } catch (e) {
      setBanner(dataErrorMessage(e, 'save'));
      haptic.error();
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!existing || busy) return;
    setBusy(true);
    setBanner(null);
    try {
      await removeItem(existing.id);
      haptic.success();
      onDeleted(existing);
    } catch (e) {
      setBanner(dataErrorMessage(e, 'delete'));
      haptic.error();
      setBusy(false);
    }
  }

  const fieldProps = {
    editable: !busy,
    autoComplete: 'off',
    importantForAutofill: 'no',
    textContentType: 'none',
    autoCorrect: false,
  } as const;

  return (
    <Modal transparent animationType="fade" onRequestClose={busy ? undefined : onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} accessibilityRole="button" accessibilityLabel={form.close} />
        <View style={[styles.sheet, { paddingBottom: space.xl + insets.bottom }]} accessibilityViewIsModal>
          <View style={styles.header}>
            <AppText variant="heading" style={styles.headerText} numberOfLines={2}>
              {existing ? form.editTitle : form.newTitle}
            </AppText>
            <Pressable onPress={onClose} disabled={busy} hitSlop={8} accessibilityRole="button" accessibilityLabel={form.close} style={styles.iconButton}>
              <Icon name="x" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.fields} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {banner ? <Banner tone="error" message={banner} /> : null}

            <GlowField
              {...fieldProps}
              label={form.name}
              icon="package"
              value={name}
              onChangeText={(text) => {
                setName(text);
                clear('name');
              }}
              error={errors.name}
              autoCapitalize="sentences"
              returnKeyType="next"
              submitBehavior="submit"
            />

            <View style={styles.pair}>
              <View style={styles.pairItem}>
                <GlowField
                  {...fieldProps}
                  label={form.quantity}
                  icon="hash"
                  value={quantity}
                  onChangeText={(text) => {
                    setQuantity(digitsOnly(text));
                    clear('quantity');
                  }}
                  error={errors.quantity}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={6}
                  returnKeyType="next"
                  submitBehavior="submit"
                />
              </View>
              <View style={styles.pairItem}>
                <GlowField
                  {...fieldProps}
                  label={form.unit}
                  icon="tag"
                  value={unit}
                  onChangeText={setUnit}
                  // The suggested unit ("copë") is replaced as soon as something else is typed.
                  selectTextOnFocus
                  autoCapitalize="none"
                  maxLength={20}
                  returnKeyType="next"
                  submitBehavior="submit"
                />
              </View>
            </View>

            <View style={styles.minimum}>
              <GlowField
                {...fieldProps}
                label={form.min}
                icon="alert"
                value={minQuantity}
                onChangeText={(text) => {
                  setMinQuantity(digitsOnly(text));
                  clear('min');
                }}
                error={errors.min}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
              <AppText variant="caption" color={colors.textSubtle} style={styles.hint}>
                {form.minHint}
              </AppText>
            </View>
          </ScrollView>

          {confirming && existing ? (
            <View style={styles.confirm}>
              <AppText variant="body">{form.confirmDelete(existing.name)}</AppText>
              <View style={styles.pair}>
                <View style={styles.pairItem}>
                  <GradientButton variant="ghost" label={form.cancel} onPress={() => setConfirming(false)} disabled={busy} />
                </View>
                <View style={styles.pairItem}>
                  <GradientButton variant="dangerSolid" label={strings.confirm.delete} loadingLabel={form.deleting} loading={busy} onPress={handleDelete} />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.actions}>
              <GradientButton
                label={existing ? form.saveChanges : form.save}
                loadingLabel={form.saving}
                loading={busy}
                icon="check"
                iconPosition="start"
                onPress={handleSave}
              />
              {existing ? (
                <GradientButton variant="danger" label={form.delete} icon="trash" iconPosition="start" disabled={busy} onPress={() => setConfirming(true)} />
              ) : null}
            </View>
          )}
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
    maxHeight: '92%',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerText: { flex: 1 },
  iconButton: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0 },
  fields: { gap: 14, paddingTop: 4, paddingBottom: 4 },
  pair: { flexDirection: 'row', gap: space.md },
  pairItem: { flex: 1 },
  minimum: { gap: 6 },
  hint: { marginLeft: 4 },
  actions: { gap: 16 },
  confirm: { gap: space.md },
});
