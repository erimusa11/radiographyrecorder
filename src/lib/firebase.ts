import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { type Auth, getAuth, initializeAuth } from 'firebase/auth';
import { type Firestore, getFirestore, initializeFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

import { secureStorage } from '@/lib/secureStorage';
import type { KeyValueStorage } from '@/utils/chunkedStorage';

// Values come from .env (EXPO_PUBLIC_* variables are inlined at build time). They identify the project; they are not secrets.
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

/**
 * Earlier builds kept the saved sign-in (a login token) in plain AsyncStorage. It now lives in the encrypted secure
 * store, so wipe the old copy: a token left behind in plain storage would defeat the point. Runs once per launch, quietly.
 */
function removeLegacySession() {
  AsyncStorage.getAllKeys()
    .then((keys) => {
      const old = keys.filter((key) => key.startsWith('firebase:'));
      return old.length ? AsyncStorage.multiRemove(old) : undefined;
    })
    .catch(() => {});
}

function createAuth(): Auth | null {
  if (!isFirebaseConfigured) return null;
  const app = getApps().length ? getApp() : initializeApp(config);
  if (Platform.OS === 'web') return getAuth(app);
  removeLegacySession();
  try {
    // Only exported by the React Native build of firebase/auth, so it is missing from the web typings.
    const { getReactNativePersistence } = FirebaseAuth as unknown as {
      getReactNativePersistence: (storage: KeyValueStorage) => FirebaseAuth.Persistence;
    };
    // Keeps the user signed in between app launches, in the encrypted secure store.
    return initializeAuth(app, { persistence: getReactNativePersistence(secureStorage) });
  } catch {
    // Already initialised (fast refresh): reuse it.
    return getAuth(app);
  }
}

function createDb(): Firestore | null {
  if (!isFirebaseConfigured) return null;
  const app = getApps().length ? getApp() : initializeApp(config);
  try {
    return initializeFirestore(app, { experimentalForceLongPolling: true });
  } catch {
    return getFirestore(app);
  }
}

/**
 * Where the Firebase session is kept for a sign-in. "Remember me" keeps it on the device, so the next launch opens straight
 * into the app. Without it the session ends with the browser tab (web) or when the app is closed (phone).
 */
export function sessionPersistence(remember: boolean): FirebaseAuth.Persistence {
  // The two persistence kinds live in different builds of firebase/auth, so read them off the namespace.
  const kinds = FirebaseAuth as unknown as {
    browserLocalPersistence?: FirebaseAuth.Persistence;
    browserSessionPersistence?: FirebaseAuth.Persistence;
    getReactNativePersistence?: (storage: KeyValueStorage) => FirebaseAuth.Persistence;
  };
  if (Platform.OS === 'web') {
    return (remember ? kinds.browserLocalPersistence : kinds.browserSessionPersistence) ?? FirebaseAuth.inMemoryPersistence;
  }
  return remember && kinds.getReactNativePersistence
    ? kinds.getReactNativePersistence(secureStorage)
    : FirebaseAuth.inMemoryPersistence;
}

export const auth = createAuth();
/** The Firestore database. Not used by the login screen yet; the next screens will read and write here. */
export const db = createDb();
