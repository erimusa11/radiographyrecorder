import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { LungMark } from '@/components/brand/LungMark';
import { AppText } from '@/components/ui/AppText';
import type { BannerTone } from '@/components/ui/Banner';
import { GlowField } from '@/components/ui/GlowField';
import { GradientButton } from '@/components/ui/GradientButton';
import { Icon } from '@/components/ui/Icon';
import { strings } from '@/constants/strings';
import { useStock } from '@/context/StockContext';
import { colors, fonts, MIN_TARGET, radius, space } from '@/theme';
import type { StockItem } from '@/types/stock';
import { dataErrorMessage } from '@/utils/dataErrors';
import { haptic } from '@/utils/haptics';
import { stockLevel } from '@/utils/stock';
import { foldText } from '@/utils/text';

import { StockItemSheet } from './StockItemSheet';

const { stock: text } = strings;

type Props = {
  onMessage: (tone: BannerTone, message: string) => void;
};

function LevelBadge({ level }: { level: 'low' | 'out' }) {
  const out = level === 'out';
  return (
    <View style={[styles.badge, out ? styles.badgeOut : styles.badgeLow]}>
      <AppText variant="hud" color={out ? colors.danger : colors.warning} style={styles.badgeText}>
        {out ? text.out : text.low}
      </AppText>
    </View>
  );
}

function StockRow({
  item,
  inList,
  onEdit,
  onAdjust,
  onAddToList,
}: {
  item: StockItem;
  inList: boolean;
  onEdit: () => void;
  onAdjust: (delta: number) => void;
  onAddToList: () => void;
}) {
  const level = stockLevel(item);
  const tint = level === 'out' ? colors.danger : level === 'low' ? colors.warning : colors.text;
  return (
    <View style={[styles.card, level === 'out' && styles.cardOut, level === 'low' && styles.cardLow]}>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={text.edit(item.name, item.quantity, item.unit)}
        style={({ pressed }) => [styles.top, pressed && styles.topPressed]}>
        <View style={styles.topText}>
          <AppText variant="heading" numberOfLines={2}>
            {item.name}
          </AppText>
          {item.minQuantity > 0 ? (
            <AppText variant="caption" color={colors.textMuted}>
              {text.minimum(item.minQuantity, item.unit)}
            </AppText>
          ) : null}
        </View>
        {level !== 'ok' ? <LevelBadge level={level} /> : null}
        <Icon name="pencil" size={18} color={colors.textSubtle} />
      </Pressable>

      <View style={styles.bottom}>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => onAdjust(-1)}
            disabled={item.quantity <= 0}
            accessibilityRole="button"
            accessibilityLabel={text.decrease(item.name)}
            accessibilityState={{ disabled: item.quantity <= 0 }}
            style={[styles.step, item.quantity <= 0 && styles.stepOff]}>
            <Icon name="minus" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.quantity} accessibilityLiveRegion="polite">
            <AppText variant="title" color={tint} style={styles.quantityText}>
              {item.quantity}
            </AppText>
            {item.unit ? (
              <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
                {item.unit}
              </AppText>
            ) : null}
          </View>
          <Pressable onPress={() => onAdjust(1)} accessibilityRole="button" accessibilityLabel={text.increase(item.name)} style={styles.step}>
            <Icon name="plus" size={22} color={colors.text} />
          </Pressable>
        </View>

        {level !== 'ok' ? (
          inList ? (
            <View style={styles.inList}>
              <Icon name="check" size={16} color={colors.aqua} strokeWidth={2.2} />
              <AppText variant="label" color={colors.aqua}>
                {text.inList}
              </AppText>
            </View>
          ) : (
            <Pressable
              onPress={onAddToList}
              accessibilityRole="button"
              accessibilityLabel={text.addToListFor(item.name)}
              style={({ pressed }) => [styles.addToList, pressed && styles.addToListPressed]}>
              <Icon name="cart" size={18} color={colors.aqua} />
              <AppText variant="label" color={colors.aqua}>
                {text.addToList}
              </AppText>
            </Pressable>
          )
        ) : null}
      </View>
    </View>
  );
}

/** The "Stoku" table: every product with how many are left, quick + and − buttons, and a warning when it runs low. */
export function StockPanel({ onMessage }: Props) {
  const { stock, buy, status, refresh, adjust, addToBuy } = useStock();
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState<{ item?: StockItem } | null>(null);

  const query = foldText(search);
  const shown = useMemo(() => (query ? stock.filter((item) => foldText(item.name).includes(query)) : stock), [stock, query]);
  // Products that are already waiting in the buy list, so their "Shto në listë" button is not offered twice.
  const waiting = useMemo(() => new Set(buy.filter((line) => !line.done).map((line) => foldText(line.name))), [buy]);

  async function handleAdjust(id: string, delta: number) {
    haptic.select();
    try {
      await adjust(id, delta);
    } catch (e) {
      haptic.error();
      onMessage('error', dataErrorMessage(e));
    }
  }

  async function handleAddToList(item: StockItem) {
    try {
      // One of the product's own unit (for example 1 kuti); the amount can be changed in the list.
      const result = await addToBuy(item.name, 1, item.unit);
      if (result === 'added') {
        haptic.success();
        onMessage('info', text.addedToList(item.name));
      }
    } catch (e) {
      haptic.error();
      onMessage('error', dataErrorMessage(e));
    }
  }

  const empty =
    stock.length === 0 ? (
      <View style={styles.empty}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.emptyMark}>
          <LungMark width={120} variant="ghost" />
        </View>
        <AppText variant="heading" style={styles.center}>
          {text.emptyTitle}
        </AppText>
        <AppText variant="caption" color={colors.textMuted} style={styles.center}>
          {text.emptyText}
        </AppText>
      </View>
    ) : (
      <AppText variant="caption" color={colors.textMuted} style={[styles.center, styles.noResults]}>
        {text.noResults}
      </AppText>
    );

  return (
    <View style={styles.flex}>
      {stock.length > 0 ? (
        <View style={styles.search}>
          <GlowField
            label={text.searchLabel}
            icon="search"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            importantForAutofill="no"
            textContentType="none"
            returnKeyType="search"
            trailing={
              search ? (
                <Pressable onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel={text.clearSearch} style={styles.clear}>
                  <Icon name="x" size={20} color={colors.textMuted} />
                </Pressable>
              ) : undefined
            }
          />
        </View>
      ) : null}

      <View style={styles.flex}>
        <FlatList
          data={shown}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <StockRow
              item={item}
              inList={waiting.has(foldText(item.name))}
              onEdit={() => setSheet({ item })}
              onAdjust={(delta) => void handleAdjust(item.id, delta)}
              onAddToList={() => void handleAddToList(item)}
            />
          )}
          ListEmptyComponent={empty}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          // On the web the list shrinking while you type also counts as a "drag" and would drop the focus; phones only react to a finger.
          keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={status === 'loading'} onRefresh={refresh} tintColor={colors.aqua} />}
        />

        <View style={styles.bottom2}>
          <LinearGradient colors={['rgba(25,25,25,0)', colors.ink]} style={styles.fade} />
          <GradientButton label={text.add} icon="plus" iconPosition="start" onPress={() => setSheet({})} />
        </View>
      </View>

      {sheet ? (
        <StockItemSheet
          existing={sheet.item}
          onClose={() => setSheet(null)}
          onSaved={(item, isNew) => {
            setSheet(null);
            onMessage('info', isNew ? text.saved(item.name) : text.updated(item.name));
          }}
          onDeleted={(item) => {
            setSheet(null);
            onMessage('info', text.deleted(item.name));
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { paddingHorizontal: 20, paddingBottom: 12 },
  clear: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  // Room at the end so the last product is never hidden behind the floating button.
  listContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 110, gap: 12, flexGrow: 1 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg + 2,
    padding: space.lg,
    gap: space.md,
  },
  cardLow: { borderColor: colors.warningLine },
  cardOut: { borderColor: colors.dangerLine },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.sm },
  topPressed: { opacity: 0.7 },
  topText: { flex: 1 },
  badge: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 2 },
  badgeLow: { borderColor: colors.warningLine, backgroundColor: colors.warningSoft },
  badgeOut: { borderColor: colors.dangerLine, backgroundColor: colors.dangerSoft },
  badgeText: { letterSpacing: 1, lineHeight: 16 },
  bottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: space.md, rowGap: space.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  step: {
    width: MIN_TARGET,
    height: MIN_TARGET,
    borderRadius: MIN_TARGET / 2,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOff: { opacity: 0.3 },
  quantity: { minWidth: 56, alignItems: 'center' },
  quantityText: { fontFamily: fonts.bold, lineHeight: 30 },
  addToList: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.aquaLine,
    backgroundColor: colors.aquaSoft,
  },
  addToListPressed: { opacity: 0.7 },
  inList: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6 },
  empty: { alignItems: 'center', gap: space.md, paddingTop: 36, paddingHorizontal: 12 },
  emptyMark: { marginBottom: space.sm, opacity: 0.9 },
  center: { textAlign: 'center' },
  noResults: { paddingTop: 40 },
  bottom2: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 14, pointerEvents: 'box-none' },
  fade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, pointerEvents: 'none' },
});
