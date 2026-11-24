import type { PatientRecord } from '@/types/record';
import { cleanText, foldText } from '@/utils/text';

/** Which period the lists below the two big numbers show. */
export type Scope = 'month' | 'year';

export interface Counts {
  /** How many fall in the selected month. */
  month: number;
  /** How many fall in the whole selected year (the month included). */
  year: number;
}

export interface Tally extends Counts {
  key: string;
  label: string;
}

/** One exam type together with one film type, for example "Gjoksi · 24 × 30 cm". */
export interface Combo extends Tally {
  exam: string;
  film: string;
}

export interface DoctorReport extends Tally {
  /** True for the records that have no referring doctor written. */
  none: boolean;
  exams: Tally[];
  films: Tally[];
  combos: Combo[];
}

export interface Report {
  totals: Counts;
  doctors: DoctorReport[];
  exams: Tally[];
  films: Tally[];
}

export const countOf = (counts: Counts, scope: Scope): number => (scope === 'month' ? counts.month : counts.year);

/** The same doctor written differently ("Dr. Hoxha", "dr hoxha", "Hoxha") counts as one. */
export function doctorKey(name: string): string {
  return foldText(name)
    .replace(/[.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^dr\b\s*/, '')
    .trim();
}

interface Bucket {
  /** Every spelling seen, with how often, so the most common one is shown. */
  labels: Map<string, number>;
  month: number;
  year: number;
}

const newBucket = (): Bucket => ({ labels: new Map(), month: 0, year: 0 });

function bump(map: Map<string, Bucket>, key: string, label: string, inMonth: boolean) {
  let item = map.get(key);
  if (!item) {
    item = newBucket();
    map.set(key, item);
  }
  const text = cleanText(label);
  if (text) item.labels.set(text, (item.labels.get(text) ?? 0) + 1);
  item.year += 1;
  if (inMonth) item.month += 1;
}

function mostUsed(item: Bucket): string {
  let best = '';
  let uses = -1;
  for (const [label, count] of item.labels) {
    if (count > uses) {
      best = label;
      uses = count;
    }
  }
  return best;
}

const toTallies = (map: Map<string, Bucket>): Tally[] =>
  [...map.entries()].map(([key, item]) => ({ key, label: mostUsed(item), month: item.month, year: item.year }));

interface DoctorBucket extends Bucket {
  exams: Map<string, Bucket>;
  films: Map<string, Bucket>;
  combos: Map<string, Bucket & { examKey: string; filmKey: string }>;
}

/**
 * Counts the records of one year (and, inside it, one month) per referring doctor, exam type, film type
 * and exam + film combination. `monthIndex` is 0 for January.
 */
export function buildReport(records: readonly PatientRecord[], year: number, monthIndex: number): Report {
  const exams = new Map<string, Bucket>();
  const films = new Map<string, Bucket>();
  const doctors = new Map<string, DoctorBucket>();
  const totals: Counts = { month: 0, year: 0 };

  for (const record of records) {
    const date = new Date(record.examAt);
    if (date.getFullYear() !== year) continue;
    const inMonth = date.getMonth() === monthIndex;
    totals.year += 1;
    if (inMonth) totals.month += 1;

    const examKey = foldText(record.examType);
    const filmKey = foldText(record.filmType);
    bump(exams, examKey, record.examType, inMonth);
    bump(films, filmKey, record.filmType, inMonth);

    const key = doctorKey(record.referringDoctor);
    let doctor = doctors.get(key);
    if (!doctor) {
      doctor = { ...newBucket(), exams: new Map(), films: new Map(), combos: new Map() };
      doctors.set(key, doctor);
    }
    const written = cleanText(record.referringDoctor);
    if (written) doctor.labels.set(written, (doctor.labels.get(written) ?? 0) + 1);
    doctor.year += 1;
    if (inMonth) doctor.month += 1;
    bump(doctor.exams, examKey, record.examType, inMonth);
    bump(doctor.films, filmKey, record.filmType, inMonth);

    const comboKey = `${examKey}|${filmKey}`;
    let combo = doctor.combos.get(comboKey);
    if (!combo) {
      combo = { ...newBucket(), examKey, filmKey };
      doctor.combos.set(comboKey, combo);
    }
    combo.year += 1;
    if (inMonth) combo.month += 1;
  }

  const examLabel = (key: string) => {
    const item = exams.get(key);
    return item ? mostUsed(item) : key;
  };
  const filmLabel = (key: string) => {
    const item = films.get(key);
    return item ? mostUsed(item) : key;
  };

  return {
    totals,
    exams: toTallies(exams),
    films: toTallies(films),
    doctors: [...doctors.entries()].map(([key, doctor]) => ({
      key: key || 'none',
      none: key === '',
      label: mostUsed(doctor),
      month: doctor.month,
      year: doctor.year,
      exams: toTallies(doctor.exams),
      films: toTallies(doctor.films),
      combos: [...doctor.combos.entries()].map(([comboKey, combo]) => ({
        key: comboKey,
        exam: examLabel(combo.examKey),
        film: filmLabel(combo.filmKey),
        label: `${examLabel(combo.examKey)} · ${filmLabel(combo.filmKey)}`,
        month: combo.month,
        year: combo.year,
      })),
    })),
  };
}

/** Biggest first for the chosen period; ties fall back to the whole year, then to the name. */
export function sortByScope<T extends Tally>(items: readonly T[], scope: Scope): T[] {
  return [...items].sort((a, b) => countOf(b, scope) - countOf(a, scope) || b.year - a.year || a.label.localeCompare(b.label));
}
