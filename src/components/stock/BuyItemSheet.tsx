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
import type { BuyItem } from '@/types/stock';
import { dataErrorMessage } from '@/utils/dataErrors';
import { haptic } from '@/utils/haptics';
import { digitsOnly, parseQuantity } from '@/utils/stock';
import { cleanText, sameText } from '@/utils/text';

const { buy: text, stockForm: form } = strings;

type Props = {
  item: BuyItem;
  onSaved: (item: BuyItem) => void;
  onClose: () => void;
};

type Errors = { name?: string; quantity?: string };

/** A small sheet for changing one line of the buy list: its name, how many and the unit. Mount it only while it is visible. */
export function BuyItemSheet({ item, onSaved, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { buy, saveBuy } = useStock();

  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unit, setUnit] = useState(item.unit);
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function clear(key: keyof Errors) {
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    if (banner) setBanner(null);
  }

  async function handleSave() {
    if (busy) return;
    setBanner(null);
    const cleanName = cleanText(name);
    const amount = parseQuantity(quantity, 1);
    const next: Errors = {};
    if (!cleanName) next.name = form.nameRequired;
    else if (buy.some((line) => line.id !== item.id && sameText(line.name, cleanName))) next.name = text.exists;
    if (amount === null) next.quantity = text.quantityInvalid;
    setErrors(next);
    if (next.name || next.quantity || amount === null) {
      haptic.error();
      return;
    }

    Keyboard.dismiss();
    setBusy(true);
    try {
      await saveBuy(item.id, { name: cleanName, quantity: amount, unit: cleanText(unit) });
      haptic.success();
      onSaved({ ...item, name: cleanName, quantity: amount, unit: cleanText(unit) });
    } catch (e) {
      setBanner(dataErrorMessage(e, 'save'));
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
              {text.editTitle}
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
              onChangeText={(value) => {
                setName(value);
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
                  label={text.quantity}
                  icon="hash"
                  value={quantity}
                  onChangeText={(value) => {
                    setQuantity(digitsOnly(value));
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
                  label={text.unit}
                  icon="tag"
                  value={unit}
                  onChangeText={setUnit}
                  autoCapitalize="none"
                  maxLength={20}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>
            </View>
          </ScrollView>

          <GradientButton label={form.saveChanges} loadingLabel={form.saving} loading={busy} icon="check" iconPosition="start" onPress={handleSave} />
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
});
