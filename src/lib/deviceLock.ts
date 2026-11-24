import * as LocalAuthentication from 'expo-local-authentication';

import { markPromptClosed, markPromptOpen } from './promptState';

/** False where the app cannot ask for a screen lock at all (the web version), so the lock code can skip its checks. */
export const LOCK_SUPPORTED = true;

/** How an unlock attempt ended. */
export type UnlockResult =
  /** The person proved who they are (fingerprint, face, or the phone's PIN / pattern / password). */
  | 'success'
  /** They closed the prompt. */
  | 'cancelled'
  /** Too many wrong attempts: the phone blocks the prompt for a while. */
  | 'locked-out'
  /** The phone has no screen lock any more, so there is nothing to check against: let them in. */
  | 'unavailable'
  /** Anything else (a wrong finger, a timeout...). */
  | 'failed';

/**
 * True when the phone has a screen lock (fingerprint, face, PIN, pattern or password) the app can ask for. Without one
 * the app cannot lock itself, so it stays open, as every other app does on such a phone.
 */
export async function deviceLockAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Shows the phone's own unlock prompt. Biometrics first; the phone's PIN / pattern / password is the fallback. */
export async function unlockWithDevice(promptMessage: string, cancelLabel: string): Promise<UnlockResult> {
  markPromptOpen();
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel, disableDeviceFallback: false });
    if (result.success) return 'success';
    switch (result.error) {
      case 'user_cancel':
      case 'system_cancel':
      case 'app_cancel':
        return 'cancelled';
      case 'lockout':
        return 'locked-out';
      case 'not_enrolled':
      case 'passcode_not_set':
      case 'not_available':
        return 'unavailable';
      default:
        return 'failed';
    }
  } catch {
    return 'failed';
  } finally {
    markPromptClosed();
  }
}
