import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, StyleSheet, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { deviceLockAvailable, LOCK_SUPPORTED } from '@/lib/deviceLock';
import { promptRecentlyActive } from '@/lib/promptState';

import { LockScreen } from './LockScreen';

/**
 * How long the app may stay in the background before it asks for the fingerprint / PIN again. Short enough that a phone
 * left on a desk is covered; long enough that answering a call or checking a message does not mean unlocking every time.
 */
export const LOCK_AFTER_MS = 30_000;

/**
 * Keeps the app covered by the lock screen until the person proves who they are with the phone's own fingerprint, face or
 * PIN. It asks when a saved sign-in comes back on its own (the app was closed and opened again), and again when the app
 * returns from more than {@link LOCK_AFTER_MS} in the background. A person who has just typed their password is not asked.
 *
 * The app underneath stays mounted (so a half-filled form is still there after unlocking) but is hidden from the screen
 * reader while locked. This is a phone-only feature: it needs a screen lock set on the phone, and does nothing in a browser.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const { user, freshSignIn, signOut } = useAuth();
  const uid = user?.uid ?? null;

  // null = still checking whether the phone has a screen lock. Until we know, a returning person is kept covered.
  const [available, setAvailable] = useState<boolean | null>(LOCK_SUPPORTED ? null : false);
  const [locked, setLocked] = useState(true);
  const [seenUid, setSeenUid] = useState<string | null>(uid);
  const hiddenAt = useRef<number | null>(null);
  const signedIn = useRef(false);

  useEffect(() => {
    signedIn.current = uid !== null;
  }, [uid]);

  // A different person (or nobody) in charge of the app: start from "locked" for a saved sign-in, "open" for a fresh one.
  if (uid !== seenUid) {
    setSeenUid(uid);
    setLocked(uid === null ? true : !freshSignIn);
  }

  useEffect(() => {
    if (!LOCK_SUPPORTED) return;
    let cancelled = false;
    deviceLockAvailable().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!LOCK_SUPPORTED) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        // Remember only the first moment the app left the screen ("inactive" then "background" on an iPhone).
        if (hiddenAt.current === null) hiddenAt.current = Date.now();
        return;
      }
      const left = hiddenAt.current;
      hiddenAt.current = null;
      // Time spent behind the phone's own unlock prompt (its PIN screen can count as "background") is not time away.
      if (promptRecentlyActive()) return;
      if (left !== null && signedIn.current && Date.now() - left >= LOCK_AFTER_MS) {
        // A form left open would keep its keyboard showing above the lock screen.
        Keyboard.dismiss();
        setLocked(true);
      }
    });
    return () => subscription.remove();
  }, []);

  const unlock = useCallback(() => setLocked(false), []);

  const covered = user !== null && available !== false && locked;

  return (
    <View style={styles.root}>
      <View
        style={styles.root}
        aria-hidden={covered}
        accessibilityElementsHidden={covered}
        importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {covered ? (
        <View style={styles.cover}>
          <LockScreen onUnlocked={unlock} onSignOut={signOut} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Above everything, including the navigation stack and any open sheet, and opaque so nothing shows through.
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 },
});
