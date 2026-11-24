/** The three operations the phone's secure store offers, all by key. */
export interface RawStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** What Firebase Auth expects from a storage object (the same shape as AsyncStorage). */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** The entry under the plain key says which set of pieces is current: `v1k2:3` = version "v1k2", 3 pieces. */
const META = /^([a-z0-9]+):(\d+)$/;

/**
 * The secure store accepts only letters, digits, "." "-" and "_" in a key, and may refuse long values (about 2 KB).
 * Firebase's saved session has keys like `firebase:authUser:KEY:[DEFAULT]` and a value of a few KB, so this wrapper
 * cleans the key and keeps a long value as several short pieces (`key.<version>.0`, `key.<version>.1`, ...) plus one
 * entry under the plain key that names the current version and the number of pieces.
 *
 * A new value is written as a NEW version, and only then does the plain entry switch to it. If the app is killed in the
 * middle, the entry still points at the old, complete set (or at the new, complete one), never at a mix of both, so a
 * broken half-written session cannot reach Firebase. Unreadable or missing pieces read as "nothing saved".
 */
export function createChunkedStorage(raw: RawStore, chunkSize = 600): KeyValueStorage {
  // The limit is in bytes, but a piece is cut in characters, and one character can take up to 3 bytes: 600 characters
  // stay under 1,800 bytes, below the 2 KB the store is known to accept.
  const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');
  const pieceKey = (key: string, version: string, index: number) => `${safe(key)}.${version}.${index}`;

  async function current(key: string): Promise<{ version: string; count: number } | null> {
    const meta = await raw.get(safe(key));
    const match = meta === null ? null : META.exec(meta);
    return match ? { version: match[1], count: Number(match[2]) } : null;
  }

  async function removePieces(key: string, saved: { version: string; count: number } | null) {
    for (let index = 0; saved !== null && index < saved.count; index += 1) await raw.remove(pieceKey(key, saved.version, index));
  }

  return {
    async getItem(key) {
      const saved = await current(key);
      if (saved === null) return null;
      const parts: string[] = [];
      for (let index = 0; index < saved.count; index += 1) {
        const part = await raw.get(pieceKey(key, saved.version, index));
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join('');
    },

    async setItem(key, value) {
      const previous = await current(key);
      let version = Date.now().toString(36);
      if (previous && previous.version === version) version += 'x';

      const pieces: string[] = [];
      for (let start = 0; start < value.length; ) {
        let end = Math.min(start + chunkSize, value.length);
        // Never cut an emoji (a surrogate pair) in half: each half alone would be stored as a broken character.
        const last = value.charCodeAt(end - 1);
        if (end < value.length && last >= 0xd800 && last <= 0xdbff) end -= 1;
        pieces.push(value.slice(start, end));
        start = end;
      }
      if (pieces.length === 0) pieces.push('');

      for (let index = 0; index < pieces.length; index += 1) await raw.set(pieceKey(key, version, index), pieces[index]);
      await raw.set(safe(key), `${version}:${pieces.length}`);
      await removePieces(key, previous);
    },

    async removeItem(key) {
      const saved = await current(key);
      await raw.remove(safe(key));
      await removePieces(key, saved);
    },
  };
}
