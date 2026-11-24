import { strings } from '@/constants/strings';

const { errors } = strings;

/** Turns a Firestore (or app) error into a short message that is safe to show. */
export function dataErrorMessage(error: unknown, kind: 'save' | 'delete' | 'load' = 'save'): string {
  const code = (error as { code?: string })?.code ?? (error as { message?: string })?.message ?? '';
  if (__DEV__) console.warn('[data] error while trying to', kind, '->', code);
  if (code === 'permission-denied') return errors.permissionDenied;
  // Firestore has not been created in the Firebase console yet: a developer needs the exact fix, a user only needs to know it is not their fault.
  if (code === 'not-found' || code === 'failed-precondition') return __DEV__ ? errors.firestoreSetup : errors.dataUnavailable;
  if (code === 'timeout' || code === 'unavailable' || code === 'deadline-exceeded') return errors.network;
  return kind === 'delete' ? errors.deleteFailed : kind === 'load' ? errors.loadFailed : errors.saveFailed;
}
