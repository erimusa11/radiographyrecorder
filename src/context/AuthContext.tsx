import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { clearDemoSession, demoSignIn, restoreDemoSession, saveDemoSession } from '@/lib/demoAccount';
import { auth, isFirebaseConfigured, sessionPersistence } from '@/lib/firebase';
import type { AppUser } from '@/types/user';
import { withTimeout } from '@/utils/withTimeout';

/** How long the password-reset email request may take before the user is told the connection is too slow. */
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * How long to wait for Firebase to confirm a saved session before showing the login screen anyway.
 * Firebase checks the saved session with the server, and on a connected-but-stalled network that can take a minute.
 */
const RESTORE_WAIT_MS = 8_000;

/** How long the development demo sign-in pretends to take, so the scanning animation is seen like in a real sign-in. */
const DEMO_SIGN_IN_MS = 900;

interface AuthContextValue {
  /** The signed-in user, or null. */
  user: AppUser | null;
  /** True until Firebase has told us whether a saved session exists (or we stopped waiting for it). */
  loading: boolean;
  /** False when the Firebase settings are missing from .env. */
  configured: boolean;
  /**
   * True when the person typed their password in this run (as opposed to a saved session coming back on its own). The
   * lock screen only asks for the phone's fingerprint / PIN in the second case.
   */
  freshSignIn: boolean;
  /** `remember` keeps the person signed in on this device (the default); without it the session ends when the app or tab closes. */
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>;
  /** Sends a password-reset email. Succeeds silently for unknown emails so accounts cannot be probed. */
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<AppUser | null>(null);
  const [demoUser, setDemoUser] = useState<AppUser | null>(null);
  const [freshSignIn, setFreshSignIn] = useState(false);
  const [firebaseLoading, setLoading] = useState(isFirebaseConfigured);
  // Release builds have no demo account, so there is nothing to wait for there.
  const [demoChecked, setDemoChecked] = useState(!__DEV__);

  // Development only: bring back a demo sign-in that "remember me" kept on this device.
  useEffect(() => {
    if (!__DEV__) return;
    let cancelled = false;
    restoreDemoSession().then((saved) => {
      if (cancelled) return;
      if (saved) setDemoUser(saved);
      setDemoChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!auth) return;
    // After the wait we show the login screen, but the listener stays on: if the saved session is confirmed later,
    // `user` is set and the route guard moves the person into the app; if it was not valid they simply stay on login.
    const giveUp = setTimeout(() => setLoading(false), RESTORE_WAIT_MS);
    const unsubscribe = onAuthStateChanged(auth, (next) => {
      clearTimeout(giveUp);
      setFirebaseUser(next ? { uid: next.uid, email: next.email, isDemo: false } : null);
      setLoading(false);
    });
    return () => {
      clearTimeout(giveUp);
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string, remember = true) => {
    // Development only: the demo account signs in locally, without Firebase (always null in release builds).
    const demo = demoSignIn(email, password);
    if (demo) {
      await new Promise((resolve) => setTimeout(resolve, DEMO_SIGN_IN_MS));
      if (remember) await saveDemoSession(demo);
      else await clearDemoSession();
      setFreshSignIn(true);
      setDemoUser(demo);
      return;
    }
    if (!auth) throw new Error('not-configured');
    try {
      // Must be set before signing in: it decides where Firebase keeps this session.
      await setPersistence(auth, sessionPersistence(remember));
    } catch {
      // Storage is unavailable here (e.g. a private window). Sign in anyway; the session just will not outlive this run.
    }
    // Set BEFORE the request: Firebase announces the new user a moment before this call returns, and the lock screen
    // must already know that this person just typed their password, or it would ask for their fingerprint right away.
    setFreshSignIn(true);
    try {
      // No app-level timeout on purpose. The request cannot be cancelled, so giving up early would let a late success
      // sign the person in after the screen had already reported a failure (or replace a newer attempt). Firebase bounds
      // the request itself and reports auth/network-request-failed; the login form stays locked until then.
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      setFreshSignIn(false);
      throw error;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!auth) throw new Error('not-configured');
    try {
      await withTimeout(sendPasswordResetEmail(auth, email.trim()), REQUEST_TIMEOUT_MS);
    } catch (error) {
      if ((error as { code?: string })?.code === 'auth/user-not-found') return;
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    setFreshSignIn(false);
    setDemoUser(null);
    await clearDemoSession();
    if (auth) await firebaseSignOut(auth);
  }, []);

  const user = demoUser ?? firebaseUser;
  // A restored demo sign-in does not need to wait for Firebase to answer.
  const loading = !demoChecked || (firebaseLoading && !demoUser);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, configured: isFirebaseConfigured, freshSignIn, signIn, resetPassword, signOut }),
    [user, loading, freshSignIn, signIn, resetPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
