import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppUser } from '@/types/user';

/**
 * A built-in demo account, so the app can be tried before Firebase Authentication is set up.
 *
 * Its email and password are NOT in the code: they come from the git-ignored `.env` file
 * (`EXPO_PUBLIC_DEMO_EMAIL` and `EXPO_PUBLIC_DEMO_PASSWORD`), so they never reach the repository. Without them
 * there is no demo account at all.
 *
 * It works ONLY while developing (`npm start`, Expo Go, the web preview). Everything sits behind `__DEV__`, which is
 * false in every release build (EAS preview and production). The bundler then removes this code, and the build
 * has no `.env` file anyway, so an installed app has no way in except a real Firebase account.
 */
function demoCredentials(): { email: string; password: string } | null {
  if (!__DEV__) return null;
  const email = process.env.EXPO_PUBLIC_DEMO_EMAIL?.trim().toLowerCase();
  const password = process.env.EXPO_PUBLIC_DEMO_PASSWORD;
  return email && password ? { email, password } : null;
}

/** Returns the demo user when the credentials match, otherwise null. */
export function demoSignIn(email: string, password: string): AppUser | null {
  const demo = demoCredentials();
  if (!demo || email.trim().toLowerCase() !== demo.email || password !== demo.password) return null;
  return { uid: 'demo', email: demo.email, isDemo: true };
}

// "Remember me" for the demo account. Only the account's email is stored, never the password.
const SESSION_KEY = 'rr.demo.session.v1';

/** Remembers the demo sign-in on this device, so the next launch skips the login screen. */
export async function saveDemoSession(user: AppUser): Promise<void> {
  if (!__DEV__ || !user.email) return;
  try {
    await AsyncStorage.setItem(SESSION_KEY, user.email);
  } catch {
    // Storage unavailable (e.g. a private window): the person is signed in for this run only.
  }
}

/** The remembered demo user, or null when there is none (always null in release builds). */
export async function restoreDemoSession(): Promise<AppUser | null> {
  const demo = demoCredentials();
  if (!demo) return null;
  try {
    const email = await AsyncStorage.getItem(SESSION_KEY);
    if (email === demo.email) return { uid: 'demo', email, isDemo: true };
    // A session kept for an email the demo account no longer uses must not let anyone in.
    if (email) await AsyncStorage.removeItem(SESSION_KEY);
    return null;
  } catch {
    return null;
  }
}

/** Forgets the remembered demo sign-in (on sign-out, or when "remember me" is off). */
export async function clearDemoSession(): Promise<void> {
  if (!__DEV__) return;
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
