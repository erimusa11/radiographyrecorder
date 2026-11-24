import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { DEFAULT_EXAM_TYPES, DEFAULT_FILM_TYPES } from '@/constants/defaults';
import { useAuth } from '@/context/AuthContext';
import * as store from '@/lib/records';
import type { PatientRecord, RecordFields, RecordOptions } from '@/types/record';
import { dataErrorMessage } from '@/utils/dataErrors';
import { sortedUnique } from '@/utils/text';

type Status = 'loading' | 'ready' | 'error';

export interface SaveInput {
  fields: RecordFields;
  /** Present when an existing record is being changed. */
  existing?: PatientRecord;
  /** For a new record: the id and the time chosen when the form was first saved (kept on retries). */
  draft?: { id: string; at: number };
}

interface RecordsContextValue {
  records: PatientRecord[];
  /** The values offered by the exam-type and film-type fields. */
  options: RecordOptions;
  status: Status;
  error: string | null;
  /** A short message about what just happened (saved, changed, deleted); the list shows it for a few seconds. */
  notice: string | null;
  setNotice: (message: string | null) => void;
  refresh: () => void;
  getRecord: (id: string) => PatientRecord | undefined;
  save: (input: SaveInput) => Promise<PatientRecord>;
  remove: (id: string) => Promise<void>;
  updateOptions: (next: RecordOptions) => Promise<void>;
  /** Every record of one calendar year (not just the newest ones the list shows), for the reports. */
  loadYear: (year: number) => Promise<PatientRecord[]>;
}

const RecordsContext = createContext<RecordsContextValue | null>(null);

const starterOptions = (): RecordOptions => ({
  examTypes: sortedUnique(DEFAULT_EXAM_TYPES),
  filmTypes: sortedUnique(DEFAULT_FILM_TYPES),
  doctors: [],
});

export function RecordsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [options, setOptions] = useState<RecordOptions>(starterOptions);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // The latest lists, readable inside handlers without waiting for a re-render.
  const optionsRef = useRef<RecordOptions>(options);

  const commitOptions = useCallback((next: RecordOptions) => {
    optionsRef.current = next;
    setOptions(next);
  }, []);

  // Load the records and the lists whenever someone signs in (and when the list is refreshed).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setRecords([]);
        commitOptions(starterOptions());
        setStatus('loading');
        return;
      }
      setStatus('loading');
      try {
        const [list, stored] = await Promise.all([store.listRecords(user), store.loadOptions(user).catch(() => ({}) as Partial<RecordOptions>)]);
        if (cancelled) return;
        setRecords(list);
        commitOptions({
          examTypes: sortedUnique(stored.examTypes ?? DEFAULT_EXAM_TYPES),
          filmTypes: sortedUnique(stored.filmTypes ?? DEFAULT_FILM_TYPES),
          // Until the doctors list has been saved once, start it from the doctors already written on records.
          doctors: sortedUnique(stored.doctors ?? list.map((r) => r.referringDoctor)),
        });
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
  }, [user, reloadKey, commitOptions]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const getRecord = useCallback((id: string) => records.find((r) => r.id === id), [records]);

  const updateOptions = useCallback(
    async (next: RecordOptions) => {
      if (!user) throw new Error('signed-out');
      const previous = optionsRef.current;
      commitOptions(next);
      try {
        await store.saveOptions(user, next);
      } catch (e) {
        commitOptions(previous);
        throw e;
      }
    },
    [user, commitOptions],
  );

  const save = useCallback(
    async ({ fields, existing, draft }: SaveInput) => {
      if (!user) throw new Error('signed-out');
      let record: PatientRecord;
      if (existing) {
        record = { ...existing, ...fields, updatedAt: Date.now() };
        await store.updateRecord(user, existing.id, fields);
      } else {
        if (!draft) throw new Error('missing-draft');
        record = { id: draft.id, ...fields, examAt: draft.at, createdAt: draft.at, updatedAt: draft.at };
        await store.createRecord(user, record);
      }
      setRecords((previous) => store.sortRecords([record, ...previous.filter((r) => r.id !== record.id)]));

      // Remember a value that was typed for the first time, so it can be chosen next time. Best effort: the record is already saved.
      const current = optionsRef.current;
      const examTypes = sortedUnique([...current.examTypes, fields.examType]);
      const filmTypes = sortedUnique([...current.filmTypes, fields.filmType]);
      const doctors = sortedUnique([...current.doctors, fields.referringDoctor]);
      if (
        examTypes.length !== current.examTypes.length ||
        filmTypes.length !== current.filmTypes.length ||
        doctors.length !== current.doctors.length
      ) {
        const next = { examTypes, filmTypes, doctors };
        commitOptions(next);
        store.saveOptions(user, next).catch(() => {});
      }
      return record;
    },
    [user, commitOptions],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!user) throw new Error('signed-out');
      await store.deleteRecord(user, id);
      setRecords((previous) => previous.filter((r) => r.id !== id));
    },
    [user],
  );

  const loadYear = useCallback(
    async (year: number) => {
      if (!user) throw new Error('signed-out');
      return store.listRecordsBetween(user, new Date(year, 0, 1).getTime(), new Date(year + 1, 0, 1).getTime());
    },
    [user],
  );

  const value = useMemo<RecordsContextValue>(
    () => ({ records, options, status, error, notice, setNotice, refresh, getRecord, save, remove, updateOptions, loadYear }),
    [records, options, status, error, notice, refresh, getRecord, save, remove, updateOptions, loadYear],
  );

  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>;
}

export function useRecords(): RecordsContextValue {
  const ctx = useContext(RecordsContext);
  if (!ctx) throw new Error('useRecords must be used within a RecordsProvider');
  return ctx;
}
