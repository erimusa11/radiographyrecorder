import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, type TextInputInstance, View } from 'react-native';

import { LungMark } from '@/components/brand/LungMark';
import { AppText } from '@/components/ui/AppText';
import type { BannerTone } from '@/components/ui/Banner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { GlowField } from '@/components/ui/GlowField';
import { Icon } from '@/components/ui/Icon';
import { strings } from '@/constants/strings';
import { useStock } from '@/context/StockContext';
import { colors, gradients, MIN_TARGET, radius, space } from '@/theme';
import type { BuyItem } from '@/types/stock';
import { dataErrorMessage } from '@/utils/dataErrors';
import { haptic } from '@/utils/haptics';
import { digitsOnly, parseQuantity } from '@/utils/stock';
import { cleanText } from '@/utils/text';

import { BuyItemSheet } from './BuyItemSheet';

const { buy: text } = strings;

/** What the amount fields hold when they are empty or have just been used: one piece. */
const DEFAULT_QUANTITY = '1';
const DEFAULT_UNIT = 'copë';

type Props = {
  onMessage: (tone: BannerTone, message: string) => void;
};

type Row = { kind: 'item'; item: BuyItem } | { kind: 'header'; count: number };

function BuyRow({ item, onToggle, onEdit, onRemove }: { item: BuyItem; onToggle: () => void; onEdit: () => void; onRemove: () => void }) {
  const amount = text.amount(item.quantity, item.unit);
  return (
    <View style={[styles.row, item.done && styles.rowDone]}>
      <Pressable
        onPress={onToggle}
        role="checkbox"
        aria-checked={item.done}
        aria-label={`${item.done ? text.markNotBought(item.name) : text.markBought(item.name)}, ${amount}`}
        style={styles.toggle}>
        <View style={[styles.box, item.done && styles.boxDone]}>
          {item.done ? <Icon name="check" size={15} color={colors.onBrand} strokeWidth={2.75} /> : null}
        </View>
        <View style={styles.nameBlock}>
          <AppText variant="body" color={item.done ? colors.textSubtle : colors.text} style={item.done && styles.nameDone}>
            {item.name}
          </AppText>
          <AppText variant="caption" color={item.done ? colors.textSubtle : colors.aqua}>
            {amount}
          </AppText>
        </View>
      </Pressable>
      <Pressable onPress={onEdit} hitSlop={2} accessibilityRole="button" accessibilityLabel={text.edit(item.name, amount)} style={styles.iconButton}>
        <Icon name="pencil" size={18} color={colors.textMuted} />
      </Pressable>
      <Pressable onPress={onRemove} hitSlop={2} accessibilityRole="button" accessibilityLabel={text.remove(item.name)} style={styles.iconButton}>
        <Icon name="trash" size={19} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

/** The "Lista për t'u blerë": type what is needed (and how many), tick it when bought, clear the bought ones. */
export function BuyPanel({ onMessage }: Props) {
  const { buy, status, refresh, addToBuy, toggleBuy, removeBuy, clearBought } = useStock();
  const nameRef = useRef<TextInputInstance>(null);
  const quantityRef = useRef<TextInputInstance>(null);
  const unitRef = useRef<TextInputInstance>(null);

  const [draft, setDraft] = useState('');
  const [quantity, setQuantity] = useState(DEFAULT_QUANTITY);
  const [unit, setUnit] = useState(DEFAULT_UNIT);
  const [nameError, setNameError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BuyItem | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const open = buy.filter((line) => !line.done);
  const done = buy.filter((line) => line.done);
  const rows: Row[] = [
    ...open.map((item): Row => ({ kind: 'item', item })),
    ...(done.length > 0 ? [{ kind: 'header', count: done.length } as Row, ...done.map((item): Row => ({ kind: 'item', item }))] : []),
  ];

  async function handleAdd() {
    const name = cleanText(draft);
    if (!name || adding) return;
    const amount = parseQuantity(quantity, 1);
    if (amount === null) {
      setQuantityError(text.quantityInvalid);
      haptic.error();
      quantityRef.current?.focus();
      return;
    }
    setAdding(true);
    try {
      const result = await addToBuy(name, amount, unit);
      if (result === 'exists') {
        setNameError(text.exists);
        haptic.error();
      } else {
        setDraft('');
        setQuantity(DEFAULT_QUANTITY);
        setUnit(DEFAULT_UNIT);
        haptic.success();
        // Ready for the next product.
        nameRef.current?.focus();
      }
    } catch (e) {
      onMessage('error', dataErrorMessage(e));
      haptic.error();
    } finally {
      setAdding(false);
    }
  }

  async function run(task: () => Promise<void>) {
    try {
      await task();
    } catch (e) {
      haptic.error();
      onMessage('error', dataErrorMessage(e));
    }
  }

  async function handleClear() {
    if (clearing) return;
    setClearing(true);
    setClearError(null);
    try {
      await clearBought();
      haptic.success();
      setConfirming(false);
    } catch (e) {
      setClearError(dataErrorMessage(e, 'delete'));
      haptic.error();
    } finally {
      setClearing(false);
    }
  }

  const canAdd = cleanText(draft).length > 0 && !adding;

  const fieldProps = {
    editable: !adding,
    autoComplete: 'off',
    importantForAutofill: 'no',
    textContentType: 'none',
    autoCorrect: false,
    spellCheck: false,
  } as const;

  return (
    <View style={styles.flex}>
      <View style={styles.add}>
        <GlowField
          {...fieldProps}
          ref={nameRef}
          label={text.addLabel}
          icon="cart"
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            if (nameError) setNameError(null);
          }}
          error={nameError}
          autoCapitalize="sentences"
          returnKeyType="next"
          // Keep the keyboard open between the fields, so a product can be typed in one go.
          submitBehavior="submit"
          onSubmitEditing={() => quantityRef.current?.focus()}
        />
        <View style={styles.addRow}>
          <View style={styles.quantityField}>
            <GlowField
              {...fieldProps}
              ref={quantityRef}
              label={text.quantity}
              icon="hash"
              value={quantity}
              onChangeText={(value) => {
                setQuantity(digitsOnly(value));
                if (quantityError) setQuantityError(null);
              }}
              error={quantityError}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={6}
              selectTextOnFocus
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => unitRef.current?.focus()}
            />
          </View>
          <View style={styles.unitField}>
            <GlowField
              {...fieldProps}
              ref={unitRef}
              label={text.unit}
              icon="tag"
              value={unit}
              onChangeText={setUnit}
              autoCapitalize="none"
              maxLength={20}
              // The suggested unit ("copë") is replaced as soon as something else is typed.
              selectTextOnFocus
              returnKeyType="done"
              submitBehavior="submit"
              onSubmitEditing={handleAdd}
            />
          </View>
          <Pressable
            onPress={handleAdd}
            disabled={!canAdd}
            accessibilityRole="button"
            accessibilityLabel={text.add}
            accessibilityState={{ disabled: !canAdd, busy: adding }}
            style={[styles.addButton, !canAdd && styles.addButtonOff]}>
            {canAdd ? <LinearGradient colors={gradients.brand} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
            <Icon name="plus" size={24} color={canAdd ? colors.onBrand : colors.textSubtle} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => (row.kind === 'header' ? 'bought-header' : row.item.id)}
        renderItem={({ item: row }) =>
          row.kind === 'header' ? (
            <View style={styles.header}>
              <AppText variant="hud" color={colors.textSubtle} style={styles.headerText}>
                {text.bought}  ·  {row.count}
              </AppText>
              <Pressable
                onPress={() => {
                  setClearError(null);
                  setConfirming(true);
                }}
                hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={text.clearBought}
                style={styles.clear}>
                <Icon name="trash" size={16} color={colors.aqua} />
                <AppText variant="label" color={colors.aqua}>
                  {text.clearBought}
                </AppText>
              </Pressable>
            </View>
          ) : (
            <BuyRow
              item={row.item}
              onToggle={() => {
                haptic.select();
                void run(() => toggleBuy(row.item.id));
              }}
              onEdit={() => setEditing(row.item)}
              onRemove={() => {
                haptic.tap();
                void run(() => removeBuy(row.item.id));
              }}
            />
          )
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.emptyMark}>
              <LungMark width={110} variant="ghost" />
            </View>
            <AppText variant="heading" style={styles.center}>
              {text.emptyTitle}
            </AppText>
            <AppText variant="caption" color={colors.textMuted} style={styles.center}>
              {text.emptyText}
            </AppText>
          </View>
        }
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={status === 'loading'} onRefresh={refresh} tintColor={colors.aqua} />}
      />

      {editing ? (
        <BuyItemSheet
          // The line may have been changed or removed while the sheet is open; always show the latest copy.
          item={buy.find((line) => line.id === editing.id) ?? editing}
          onClose={() => setEditing(null)}
          onSaved={(item) => {
            setEditing(null);
            onMessage('info', text.updated(item.name));
          }}
        />
      ) : null}

      {confirming ? (
        <ConfirmDialog
          title={text.clearTitle}
          message={text.clearText(done.length)}
          confirmLabel={text.clear}
          busyLabel={text.clearing}
          cancelLabel={strings.confirm.cancel}
          busy={clearing}
          error={clearError}
          onConfirm={handleClear}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  add: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  quantityField: { flex: 1 },
  unitField: { flex: 1.1 },
  addButton: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.field,
    borderWidth: 1,
    borderColor: colors.line,
  },
  addButtonOff: { opacity: 0.6 },
  listContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, gap: 8, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingLeft: space.lg,
  },
  rowDone: { backgroundColor: 'transparent' },
  toggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: MIN_TARGET + 12, paddingVertical: 6 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: { backgroundColor: colors.aqua, borderColor: colors.aqua },
  nameBlock: { flex: 1 },
  nameDone: { textDecorationLine: 'line-through' },
  iconButton: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.lg, paddingBottom: 2 },
  headerText: { flex: 1 },
  clear: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty: { alignItems: 'center', gap: space.md, paddingTop: 36, paddingHorizontal: 12 },
  emptyMark: { marginBottom: space.sm, opacity: 0.9 },
  center: { textAlign: 'center' },
});
