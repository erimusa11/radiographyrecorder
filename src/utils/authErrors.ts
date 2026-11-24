import { strings } from '@/constants/strings';

const { errors } = strings;

// When Firebase sign-in is not switched on, a developer needs the exact fix, while a user only needs to know it is not their fault.
const unavailable = __DEV__ ? errors.setupNeeded : errors.unavailable;

// Wrong password, unknown email and a bad credential all get the same message on purpose,
// so the screen never reveals whether an account exists.
const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': errors.credentials,
  'auth/wrong-password': errors.credentials,
  'auth/user-not-found': errors.credentials,
  'auth/invalid-login-credentials': errors.credentials,
  'auth/invalid-email': strings.validation.emailInvalid,
  'auth/missing-password': strings.validation.passwordRequired,
  'auth/user-disabled': errors.disabled,
  'auth/too-many-requests': errors.tooMany,
  'auth/network-request-failed': errors.network,
  'auth/operation-not-allowed': unavailable,
  'auth/admin-restricted-operation': unavailable,
  'auth/configuration-not-found': unavailable,
  'auth/invalid-api-key': unavailable,
  'auth/app-not-authorized': unavailable,
  'not-configured': __DEV__ ? errors.notConfigured : errors.unavailable,
  timeout: errors.timeout,
};

/** Turns a Firebase (or app) error into a short message that is safe to show to the user. */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? (error as { message?: string })?.message ?? '';
  if (__DEV__ && !(code in MESSAGES)) console.warn('[auth] unmapped error code:', code);
  return MESSAGES[code] ?? errors.generic;
}
