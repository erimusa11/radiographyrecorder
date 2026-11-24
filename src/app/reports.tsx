import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { LungMark } from '@/components/brand/LungMark';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Bar, BarRow } from '@/components/ui/Bar';
import { BrandLoader } from '@/components/ui/BrandLoader';
import { GradientButton } from '@/components/ui/GradientButton';
import { HudBar } from '@/components/ui/HudBar';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { TabBar } from '@/components/ui/TabBar';
import { strings } from '@/constants/strings';
import { useRecords } from '@/context/RecordsContext';
import { colors, fonts, gradients, MIN_TARGET, radius, space } from '@/theme';
import type { PatientRecord } from '@/types/record';
import { dataErrorMessage } from '@/utils/dataErrors';
import { MONTH_NAMES } from '@/utils/dates';
import { buildReport, countOf, type DoctorReport, type Scope, sortByScope, type Tally } from '@/utils/reports';

const { reports } = strings;

/** How many years back the month arrows can go. */
const YEARS_BACK = 5;

/** A big number for one period. Tapping it chooses that period for the lists below. */
function StatTile({ label, sub, value, selected, onPress }: { label: string; sub: string; value: number | null; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} ${sub}: ${value ?? 0} ${reports.referrals}`}
      style={[styles.tile, selected && styles.tileSelected]}>
      {selected ? (
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.tileEdge} />
      ) : null}
      <AppText variant="hud" color={selected ? colors.aqua : colors.textSubtle}>
        {label}  ·  {sub}
      </AppText>
      <AppText variant="display" color={colors.text} style={styles.tileValue}>
        {value ?? '–'}
      </AppText>
      <AppText variant="caption" color={selected ? colors.text : colors.textMuted}>
        {reports.referrals}
      </AppText>
    </Pressable>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <AppText variant="heading">{title}</AppText>
      {hint ? (
        <AppText variant="caption" color={colors.textMuted}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/** A small pill: a name and how many. */
function Chip({ item, scope }: { item: Tally; scope: Scope }) {
  return (
    <View style={styles.chip}>
      <AppText variant="caption" color={colors.text}>
        {item.label}
      </AppText>
      <AppText variant="caption" color={colors.aqua} style={styles.chipCount}>
        {countOf(item, scope)}
      </AppText>
    </View>
  );
}

/** Only what happened in the chosen period, biggest first. */
const inScope = <T extends Tally>(items: readonly T[], scope: Scope): T[] => sortByScope(items, scope).filter((item) => countOf(item, scope) > 0);

function DoctorCard({
  doctor,
  rank,
  scope,
  max,
  periodLabel,
  expanded,
  onToggle,
}: {
  doctor: DoctorReport;
  rank: number;
  scope: Scope;
  max: number;
  periodLabel: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const name = doctor.none ? reports.noDoctor : doctor.label;
  const value = countOf(doctor, scope);
  const combos = inScope(doctor.combos, scope);
  const exams = inScope(doctor.exams, scope);
  const films = inScope(doctor.films, scope);
  const comboMax = combos.length ? countOf(combos[0], scope) : 1;

  return (
    <View style={[styles.doctor, expanded && styles.doctorOpen]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${name}: ${reports.doctorTotals(doctor.month, doctor.year)}`}
        accessibilityHint={expanded ? reports.collapse : reports.expand}
        style={styles.doctorHead}>
        <View style={styles.rank}>
          <AppText variant="hud" color={colors.aqua} style={styles.rankText}>
            {rank}
          </AppText>
        </View>
        <View style={styles.doctorName}>
          <AppText variant="heading" numberOfLines={1}>
            {name}
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {reports.doctorTotals(doctor.month, doctor.year)}
          </AppText>
        </View>
        <AppText variant="title" color={value > 0 ? colors.aqua : colors.textSubtle}>
          {value}
        </AppText>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </Pressable>

      <Bar ratio={value > 0 ? Math.max(value / max, 0.04) : 0} />

      {expanded ? (
        <Animated.View entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)} style={styles.detail}>
          <AppText variant="hud" color={colors.aqua}>
            {reports.sent}  ·  {periodLabel}
          </AppText>
          {combos.length === 0 ? (
            <AppText variant="caption" color={colors.textMuted}>
              {reports.nothingInPeriod}
            </AppText>
          ) : (
            <>
              <AppText variant="label" color={colors.textMuted}>
                {reports.combos}
              </AppText>
              <View style={styles.rows}>
                {combos.map((combo) => (
                  <BarRow key={combo.key} label={combo.label} value={countOf(combo, scope)} max={comboMax} />
                ))}
              </View>
              <AppText variant="label" color={colors.textMuted}>
                {reports.exams}
              </AppText>
              <View style={styles.chips}>
                {exams.map((item) => (
                  <Chip key={item.key} item={item} scope={scope} />
                ))}
              </View>
              <AppText variant="label" color={colors.textMuted}>
                {reports.films}
              </AppText>
              <View style={styles.chips}>
                {films.map((item) => (
                  <Chip key={item.key} item={item} scope={scope} />
                ))}
              </View>
            </>
          )}
        </Animated.View>
      ) : null}
    </View>
  );
}

function Panel({ title, items, scope }: { title: string; items: Tally[]; scope: Scope }) {
  const list = inScope(items, scope);
  const max = list.length ? countOf(list[0], scope) : 1;
  return (
    <View style={styles.panel}>
      <AppText variant="hud" color={colors.aqua}>
        {title}
      </AppText>
      {list.length === 0 ? (
        <AppText variant="caption" color={colors.textMuted}>
          {reports.nothingInPeriod}
        </AppText>
      ) : (
        <View style={styles.rows}>
          {list.map((item) => (
            <BarRow key={item.key} label={item.label} value={countOf(item, scope)} max={max} />
          ))}
        </View>
      )}
    </View>
  );
}

/** How many patients each referring doctor sent, this month and this year, and what they sent. */
export default function ReportsScreen() {
  const { loadYear } = useRecords();
  const [now] = useState(() => new Date());
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [scope, setScope] = useState<Scope>('month');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [data, setData] = useState<{ year: number; records: PatientRecord[] } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // The reports read the whole selected year, not only the newest records the list screen keeps.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('loading');
      try {
        const records = await loadYear(year);
        if (cancelled) return;
        setData({ year, records });
        setError(null);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setError(dataErrorMessage(e, 'load'));
        setStatus('error');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [year, loadYear, attempt]);

  const report = useMemo(() => (data && data.year === year ? buildReport(data.records, year, month) : null), [data, year, month]);

  const doctors = useMemo(() => {
    if (!report) return [];
    const sorted = sortByScope(report.doctors, scope);
    // The records with no doctor written always come last.
    return [...sorted.filter((d) => !d.none), ...sorted.filter((d) => d.none)];
  }, [report, scope]);
  const maxDoctor = Math.max(1, ...doctors.map((d) => countOf(d, scope)));

  const atNewest = year === now.getFullYear() && month === now.getMonth();
  const atOldest = year === now.getFullYear() - YEARS_BACK && month === 0;
  const periodLabel = scope === 'month' ? reports.periodMonth(MONTH_NAMES[month], year) : reports.periodYear(year);

  function shift(delta: number) {
    let nextYear = year;
    let nextMonth = month + delta;
    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    } else if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    setYear(nextYear);
    setMonth(nextMonth);
    setExpanded(null);
  }

  return (
    <Screen bottomInset={false}>
      <HudBar />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        refreshControl={<RefreshControl refreshing={status === 'loading' && data !== null} onRefresh={() => setAttempt((n) => n + 1)} tintColor={colors.aqua} />}>
        <View style={styles.header}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <LungMark width={44} variant="lit" />
          </View>
          <View style={styles.headerText}>
            <AppText variant="title" accessibilityRole="header">
              {reports.title}
            </AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {reports.subtitle}
            </AppText>
          </View>
        </View>

        <View style={styles.stepper}>
          <Pressable
            onPress={() => shift(-1)}
            disabled={atOldest}
            accessibilityRole="button"
            accessibilityLabel={reports.previousMonth}
            accessibilityState={{ disabled: atOldest }}
            style={[styles.step, atOldest && styles.stepOff]}>
            <Icon name="chevron-left" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.stepLabel} accessibilityLiveRegion="polite">
            <AppText variant="title">{MONTH_NAMES[month]}</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {year}
            </AppText>
          </View>
          <Pressable
            onPress={() => shift(1)}
            disabled={atNewest}
            accessibilityRole="button"
            accessibilityLabel={reports.nextMonth}
            accessibilityState={{ disabled: atNewest }}
            style={[styles.step, atNewest && styles.stepOff]}>
            <Icon name="chevron-right" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.tiles}>
          <StatTile label={reports.month} sub={MONTH_NAMES[month]} value={report ? report.totals.month : null} selected={scope === 'month'} onPress={() => setScope('month')} />
          <StatTile label={reports.year} sub={String(year)} value={report ? report.totals.year : null} selected={scope === 'year'} onPress={() => setScope('year')} />
        </View>
        <AppText variant="caption" color={colors.textSubtle} style={styles.pick}>
          {reports.pickPeriod}
        </AppText>

        {status === 'error' && !report ? (
          <View style={styles.state}>
            <Banner tone="error" message={error ?? strings.errors.loadFailed} />
            <GradientButton variant="ghost" label={reports.retry} onPress={() => setAttempt((n) => n + 1)} />
          </View>
        ) : null}

        {!report && status === 'loading' ? (
          <View style={styles.state}>
            <BrandLoader size={32} color={colors.aqua} />
            <AppText variant="caption" color={colors.textMuted}>
              {reports.loading}
            </AppText>
          </View>
        ) : null}

        {report && report.totals.year === 0 ? (
          <View style={styles.state}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.emptyMark}>
              <LungMark width={110} variant="ghost" />
            </View>
            <AppText variant="body" color={colors.textMuted} style={styles.center}>
              {reports.emptyYear(year)}
            </AppText>
          </View>
        ) : null}

        {report && report.totals.year > 0 ? (
          <>
            <SectionTitle title={reports.byDoctor} hint={reports.byDoctorHint} />
            <View style={styles.list}>
              {doctors.map((doctor, index) => (
                <DoctorCard
                  key={doctor.key}
                  doctor={doctor}
                  rank={index + 1}
                  scope={scope}
                  max={maxDoctor}
                  periodLabel={periodLabel}
                  expanded={expanded === doctor.key}
                  onToggle={() => setExpanded((current) => (current === doctor.key ? null : doctor.key))}
                />
              ))}
            </View>

            <SectionTitle title={reports.overall} hint={periodLabel} />
            <Panel title={reports.exams} items={report.exams} scope={scope} />
            <Panel title={reports.films} items={report.films} scope={scope} />
          </>
        ) : null}
      </ScrollView>
      <TabBar active="reports" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerText: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
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
  stepLabel: { alignItems: 'center' },
  tiles: { flexDirection: 'row', gap: space.md },
  tile: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.lg + 2,
    paddingBottom: space.lg,
    gap: 2,
    overflow: 'hidden',
  },
  tileSelected: { borderColor: colors.aquaLine, backgroundColor: colors.aquaSoft },
  tileEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  tileValue: { fontFamily: fonts.bold, fontSize: 44, lineHeight: 54 },
  pick: { textAlign: 'center', marginTop: -6 },
  sectionTitle: { gap: 2, marginTop: space.sm },
  list: { gap: 12 },
  doctor: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: 12,
  },
  doctorOpen: { borderColor: colors.aquaLine },
  doctorHead: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TARGET },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.aquaLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { letterSpacing: 0, lineHeight: 16, fontSize: 11 },
  doctorName: { flex: 1 },
  detail: { gap: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.line },
  rows: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  chipCount: { fontFamily: fonts.semibold },
  panel: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: 14,
  },
  state: { alignItems: 'center', gap: space.lg, paddingTop: 24 },
  emptyMark: { opacity: 0.9 },
  center: { textAlign: 'center' },
});
