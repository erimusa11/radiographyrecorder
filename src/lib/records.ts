import {
  collection,
  deleteDoc,
  doc,
  type DocumentData,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { firestore, isLocal, millis, READ_TIMEOUT_MS, readLocal, WRITE_TIMEOUT_MS, writeLocal } from '@/lib/storage';
import type { PatientRecord, RecordFields, RecordOptions } from '@/types/record';
import type { AppUser } from '@/types/user';
import { withTimeout } from '@/utils/withTimeout';

// Where things live in Firestore. Patient records: /radiographs/{id}. The lists behind the type-or-choose fields: /settings/options.
const RECORDS = 'radiographs';
const SETTINGS = 'settings';
const OPTIONS_DOC = 'options';
/** The list screen loads the newest records only. The reports load a whole year, so they have a much higher limit. */
const LIST_LIMIT = 500;
const REPORT_LIMIT = 10_000;

// Where the development demo account keeps its data (on this device only, see storage.ts).
const LOCAL_RECORDS = 'rr.demo.records.v1';
const LOCAL_OPTIONS = 'rr.demo.options.v1';

/** Newest exam first. */
export function sortRecords(list: readonly PatientRecord[]): PatientRecord[] {
  return [...list].sort((a, b) => b.examAt - a.examAt);
}

function fromDoc(id: string, data: DocumentData): PatientRecord {
  return {
    id,
    fullName: String(data.fullName ?? ''),
    idNumber: String(data.idNumber ?? ''),
    residence: String(data.residence ?? ''),
    age: Number(data.age ?? 0),
    referringDoctor: String(data.referringDoctor ?? ''),
    examType: String(data.examType ?? ''),
    filmType: String(data.filmType ?? ''),
    examAt: millis(data.examAt),
    createdAt: millis(data.createdAt),
    updatedAt: millis(data.updatedAt),
  };
}

const asStrings = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;

export async function listRecords(user: AppUser): Promise<PatientRecord[]> {
  if (isLocal(user)) return sortRecords(await readLocal<PatientRecord[]>(LOCAL_RECORDS, []));
  const snapshot = await withTimeout(
    getDocs(query(collection(firestore(), RECORDS), orderBy('examAt', 'desc'), limit(LIST_LIMIT))),
    READ_TIMEOUT_MS,
  );
  return snapshot.docs.map((d) => fromDoc(d.id, d.data()));
}

/** Every record whose exam time lies in [startMs, endMs): what a report for a month or a year is built from. */
export async function listRecordsBetween(user: AppUser, startMs: number, endMs: number): Promise<PatientRecord[]> {
  if (isLocal(user)) {
    const all = await readLocal<PatientRecord[]>(LOCAL_RECORDS, []);
    return sortRecords(all.filter((r) => r.examAt >= startMs && r.examAt < endMs));
  }
  const snapshot = await withTimeout(
    getDocs(
      query(
        collection(firestore(), RECORDS),
        where('examAt', '>=', Timestamp.fromMillis(startMs)),
        where('examAt', '<', Timestamp.fromMillis(endMs)),
        orderBy('examAt', 'desc'),
        limit(REPORT_LIMIT),
      ),
    ),
    READ_TIMEOUT_MS * 2,
  );
  return snapshot.docs.map((d) => fromDoc(d.id, d.data()));
}

/**
 * Writes a new record. The id and the times come from the form and stay the same on a retry, so saving twice
 * (for example after a slow connection) writes the same record again instead of creating a second one.
 */
export async function createRecord(user: AppUser, record: PatientRecord): Promise<void> {
  if (isLocal(user)) {
    const all = await readLocal<PatientRecord[]>(LOCAL_RECORDS, []);
    await writeLocal(LOCAL_RECORDS, [record, ...all.filter((r) => r.id !== record.id)]);
    return;
  }
  const { id, examAt, createdAt, ...fields } = record;
  await withTimeout(
    setDoc(doc(firestore(), RECORDS, id), {
      ...fields,
      examAt: Timestamp.fromMillis(examAt),
      createdAt: Timestamp.fromMillis(createdAt),
      updatedAt: serverTimestamp(),
      createdBy: user.uid,
      updatedBy: user.uid,
    }),
    WRITE_TIMEOUT_MS,
  );
}

/** Changes the typed fields of a record. The exam date and time never change. */
export async function updateRecord(user: AppUser, id: string, fields: RecordFields): Promise<void> {
  if (isLocal(user)) {
    const all = await readLocal<PatientRecord[]>(LOCAL_RECORDS, []);
    await writeLocal(
      LOCAL_RECORDS,
      all.map((r) => (r.id === id ? { ...r, ...fields, updatedAt: Date.now() } : r)),
    );
    return;
  }
  await withTimeout(
    updateDoc(doc(firestore(), RECORDS, id), { ...fields, updatedAt: serverTimestamp(), updatedBy: user.uid }),
    WRITE_TIMEOUT_MS,
  );
}

export async function deleteRecord(user: AppUser, id: string): Promise<void> {
  if (isLocal(user)) {
    const all = await readLocal<PatientRecord[]>(LOCAL_RECORDS, []);
    await writeLocal(
      LOCAL_RECORDS,
      all.filter((r) => r.id !== id),
    );
    return;
  }
  await withTimeout(deleteDoc(doc(firestore(), RECORDS, id)), WRITE_TIMEOUT_MS);
}

/** The saved lists. A list that was never saved comes back undefined, so the caller can offer the starter values. */
export async function loadOptions(user: AppUser): Promise<Partial<RecordOptions>> {
  if (isLocal(user)) return readLocal<Partial<RecordOptions>>(LOCAL_OPTIONS, {});
  const snapshot = await withTimeout(getDoc(doc(firestore(), SETTINGS, OPTIONS_DOC)), READ_TIMEOUT_MS);
  const data = snapshot.data();
  return { examTypes: asStrings(data?.examTypes), filmTypes: asStrings(data?.filmTypes), doctors: asStrings(data?.doctors) };
}

export async function saveOptions(user: AppUser, options: RecordOptions): Promise<void> {
  if (isLocal(user)) {
    await writeLocal(LOCAL_OPTIONS, options);
    return;
  }
  await withTimeout(
    setDoc(
      doc(firestore(), SETTINGS, OPTIONS_DOC),
      { examTypes: options.examTypes, filmTypes: options.filmTypes, doctors: options.doctors },
      { merge: true },
    ),
    WRITE_TIMEOUT_MS,
  );
}
