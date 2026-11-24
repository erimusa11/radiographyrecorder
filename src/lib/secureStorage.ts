import * as SecureStore from 'expo-secure-store';

import { createChunkedStorage, type KeyValueStorage } from '@/utils/chunkedStorage';

// Android: encrypted with a key kept in the Android Keystore. iPhone: the Keychain, never copied to a backup or a new device.
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

const chunked = createChunkedStorage({
  get: (key) => SecureStore.getItemAsync(key, options),
  set: (key, value) => SecureStore.setItemAsync(key, value, options),
  remove: (key) => SecureStore.deleteItemAsync(key, options),
});

function note(action: string, error: unknown) {
  if (__DEV__) console.warn('[secure storage] could not', action, '->', error);
}

/**
 * Where the phone keeps the saved Firebase sign-in ("remember me"): the encrypted secure store instead of plain
 * AsyncStorage. If the store cannot be used (a rare Keystore fault) the person is simply not remembered: a failed read
 * counts as "signed out" and a failed write only means the sign-in does not outlive this run. It never blocks signing in.
 */
export const secureStorage: KeyValueStorage = {
  async getItem(key) {
    try {
      return await chunked.getItem(key);
    } catch (error) {
      note('read', error);
      return null;
    }
  },
  async setItem(key, value) {
    try {
      await chunked.setItem(key, value);
    } catch (error) {
      note('write', error);
    }
  },
  async removeItem(key) {
    try {
      await chunked.removeItem(key);
    } catch (error) {
      note('remove', error);
    }
  },
};
