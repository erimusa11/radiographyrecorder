import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { LungMark } from '@/components/brand/LungMark';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { BrandLoader } from '@/components/ui/BrandLoader';
import { GlowField } from '@/components/ui/GlowField';
import { GradientButton } from '@/components/ui/GradientButton';
import { HudBar } from '@/components/ui/HudBar';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { TabBar } from '@/components/ui/TabBar';
import { strings } from '@/constants/strings';
import { useAuth } from '@/context/AuthContext';
import { useRecords } from '@/context/RecordsContext';
import { colors, MIN_TARGET, radius, space } from '@/theme';
import type { PatientRecord } from '@/types/record';
import { formatWhen } from '@/utils/dates';
import { foldText } from '@/utils/text';

const { list } = strings;

/** How many records are shown at first, and how many more each "Ngarko edhe" press adds. */
const PAGE_SIZE = 10;

function matches(record: PatientRecord, query: string): boolean {
  if (!query) return true;
  return [record.fullName, record.idNumber, record.residence, record.referringDoctor, record.examType, record.filmType].some((value) =>
    foldText(value).includes(query),
  );
}

function Tag({ text, strong = false }: { text: string; strong?: boolean }) {
  if (!text) return null;
  return (
    <View style={[styles.tag, strong && styles.tagStrong]}>
      <AppText variant="caption" color={strong ? colors.text : colors.textMuted} numberOfLines={1} style={styles.tagText}>
        {text}
      </AppText>
    </View>
  );
}

function RecordCard({ record, onPress }: { record: PatientRecord; onPress: () => void }) {
  const when = formatWhen(record.examAt);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${record.fullName}, ${list.years(record.age)}, ${record.examType}, ${when}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardTop}>
        <AppText variant="heading" numberOfLines={1} style={styles.cardName}>
          {record.fullName}
        </AppText>
        <Icon name="chevron-right" size={20} color={colors.textSubtle} />
      </View>
      <View style={styles.when}>
        <Icon name="clock" size={13} color={colors.aqua} />
        <AppText variant="caption" color={colors.aqua}>
          {when}
        </AppText>
      </View>
      <View style={styles.tags}>
        <Tag text={list.years(record.age)} />
        <Tag text={record.examType} strong />
        <Tag text={record.filmType} />
      </View>
      {record.referringDoctor ? (
        <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
          {list.doctor(record.referringDoctor)}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/** The page after signing in: every client record, newest first, with search, and a button to add a new one. */
export default function RecordsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { records, status, error, notice, setNotice, refresh } = useRecords();
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const query = foldText(search);
  const shown = useMemo(() => records.filter((record) => matches(record, query)), [records, query]);
  // Only the first `visible` records are drawn; "Ngarko edhe" reveals the next ones. Search still looks through all of them.
  const page = useMemo(() => shown.slice(0, visible), [shown, visible]);
  const remaining = shown.length - page.length;

  function changeSearch(text: string) {
    setSearch(text);
    setVisible(PAGE_SIZE);
  }

  // The "saved / changed / deleted" message disappears by itself.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);

  let empty;
  if (status === 'loading' && records.length === 0) {
    empty = (
      <View style={styles.empty}>
        <BrandLoader size={32} color={colors.aqua} />
        <AppText variant="caption" color={colors.textMuted}>
          {list.loading}
        </AppText>
      </View>
    );
  } else if (status === 'error' && records.length === 0) {
    empty = (
      <View style={styles.empty}>
        <Banner tone="error" message={error ?? strings.errors.loadFailed} />
        <GradientButton variant="ghost" label={list.retry} onPress={refresh} />
      </View>
    );
  } else if (records.length === 0) {
    empty = (
      <View style={styles.empty}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.emptyMark}>
          <LungMark width={120} variant="ghost" />
        </View>
        <AppText variant="heading" style={styles.emptyText}>
          {list.emptyTitle}
        </AppText>
        <AppText variant="caption" color={colors.textMuted} style={styles.emptyText}>
          {list.emptyText}
        </AppText>
      </View>
    );
  } else {
    empty = (
      <AppText variant="caption" color={colors.textMuted} style={[styles.emptyText, styles.noResults]}>
        {list.noResults}
      </AppText>
    );
  }

  return (
    <Screen bottomInset={false}>
      <HudBar />
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <LungMark width={44} variant="lit" />
          </View>
          <View style={styles.titleText}>
            <AppText variant="title" accessibilityRole="header">
              {list.title}
            </AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {query ? list.countFiltered(shown.length, records.length) : list.count(records.length)}
            </AppText>
          </View>
          <Pressable onPress={() => void signOut()} hitSlop={8} accessibilityRole="button" accessibilityLabel={list.signOut} style={styles.signOut}>
            <AppText variant="hud" color={colors.textSubtle}>
              {list.signOut}
            </AppText>
          </Pressable>
        </View>

        {notice ? <Banner tone="info" message={notice} /> : null}

        <GlowField
          label={list.searchLabel}
          icon="search"
          value={search}
          onChangeText={changeSearch}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          importantForAutofill="no"
          textContentType="none"
          returnKeyType="search"
          trailing={
            search ? (
              <Pressable onPress={() => changeSearch('')} accessibilityRole="button" accessibilityLabel={list.clearSearch} style={styles.clear}>
                <Icon name="x" size={20} color={colors.textMuted} />
              </Pressable>
            ) : undefined
          }
        />
      </View>

      <View style={styles.body}>
      <FlatList
        data={page}
        keyExtractor={(record) => record.id}
        renderItem={({ item }) => <RecordCard record={item} onPress={() => router.push({ pathname: '/record', params: { id: item.id } })} />}
        ListEmptyComponent={empty}
        ListFooterComponent={
          remaining > 0 ? (
            <View style={styles.more}>
              <AppText variant="caption" color={colors.textMuted}>
                {list.showing(page.length, shown.length)}
              </AppText>
              <GradientButton
                variant="ghost"
                label={list.loadMore(Math.min(PAGE_SIZE, remaining))}
                icon="chevron-down"
                iconPosition="start"
                onPress={() => setVisible((count) => count + PAGE_SIZE)}
              />
            </View>
          ) : undefined
        }
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        // On the web the list shrinking while you type also counts as a "drag" and would drop the focus; phones only react to a finger.
        keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={status === 'loading' && records.length > 0} onRefresh={refresh} tintColor={colors.aqua} />}
      />

      <View style={styles.bottom}>
        <LinearGradient colors={['rgba(25,25,25,0)', colors.ink]} style={styles.fade} />
        <GradientButton label={list.add} icon="plus" iconPosition="start" onPress={() => router.push('/record')} />
      </View>
      </View>
      <TabBar active="records" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  titleText: { flex: 1 },
  signOut: { minHeight: MIN_TARGET, minWidth: 56, alignItems: 'center', justifyContent: 'center' },
  clear: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  // Room at the end so the last card and the "Ngarko edhe" button are never hidden behind the floating button.
  listContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 110, gap: 12, flexGrow: 1 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg + 2,
    padding: space.lg,
    gap: 8,
  },
  cardPressed: { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: colors.aquaLine },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardName: { flex: 1 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  tagStrong: { borderColor: colors.aquaLine, backgroundColor: colors.aquaSoft },
  tagText: { fontSize: 12.5, lineHeight: 18 },
  empty: { alignItems: 'center', gap: space.md, paddingTop: 48, paddingHorizontal: 12 },
  emptyMark: { marginBottom: space.sm, opacity: 0.9 },
  emptyText: { textAlign: 'center' },
  noResults: { paddingTop: 40 },
  more: { alignItems: 'stretch', gap: space.md, paddingTop: space.sm },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 14, pointerEvents: 'box-none' },
  fade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, pointerEvents: 'none' },
});
