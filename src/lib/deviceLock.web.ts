import type { UnlockResult } from './deviceLock';

// A browser has no screen lock the page can ask for, so the web version never locks itself. Browser sign-ins end with
// the tab unless "Më mbaj mend" is ticked, and the browser profile is the person's own.
export const LOCK_SUPPORTED = false;

export async function deviceLockAvailable(): Promise<boolean> {
  return false;
}

export async function unlockWithDevice(): Promise<UnlockResult> {
  return 'unavailable';
}
