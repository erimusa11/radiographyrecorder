import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Firestore, Timestamp } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { AppUser } from '@/types/user';

// Shared by the data files (records.ts, stock.ts).

export const READ_TIMEOUT_MS = 12_000;
export const WRITE_TIMEOUT_MS = 15_000;

/** The development demo account keeps its data on this device only (it has no Firebase session to write with). */
export const isLocal = (user: AppUser) => user.isDemo || db === null;

export function firestore(): Firestore {
  if (!db) throw new Error('not-configured');
  return db;
}

export async function readLocal<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const writeLocal = (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value));

let localQueue: Promise<unknown> = Promise.resolve();

/**
 * Reads a locally stored value, changes it and writes it back, one change at a time. Without the queue two quick
 * taps (for example on a "+" button) could both read the old value and the second write would erase the first.
 */
export function updateLocal<T>(key: string, fallback: T, change: (current: T) => T): Promise<void> {
  const run = localQueue.then(async () => {
    await writeLocal(key, change(await readLocal(key, fallback)));
  });
  localQueue = run.catch(() => {});
  return run;
}

/** A Firestore time (or a plain number, as the local copy stores it) as milliseconds. */
export const millis = (value: unknown): number => (value instanceof Timestamp ? value.toMillis() : typeof value === 'number' ? value : Date.now());
