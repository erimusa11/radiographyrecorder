// Tests for src/utils/chunkedStorage.ts, the wrapper that lets Firebase keep the saved sign-in in the phone's secure store
// (25 checks, including "the app is killed at every moment while saving"). Not part of the app or its build.
//
// To run it, from the project folder (use a scratch folder instead of "out" if you prefer):
//   npx tsc src/utils/chunkedStorage.ts --ignoreConfig --outDir out --module commonjs --target es2020 --skipLibCheck --strict
//   copy this file into "out", then:  node out/chunked-storage.test.js
// The fake store below is as picky as the real one: it refuses odd key characters and values over 2 KB.
const assert = require('node:assert');
const { createChunkedStorage } = require('./chunkedStorage.js');

let pass = 0, fail = 0;
async function check(name, fn) {
  try { await fn(); pass++; console.log('PASS', name); }
  catch (e) { fail++; console.log('FAIL', name, '->', e.message); }
}

// A fake secure store that is as picky as the real one: key characters and a 2048-byte value limit.
function fakeStore({ failOnSetNumber = null } = {}) {
  const data = new Map();
  let sets = 0;
  return {
    data,
    raw: {
      async get(k) { if (!/^[A-Za-z0-9._-]+$/.test(k)) throw new Error('bad key ' + k); return data.has(k) ? data.get(k) : null; },
      async set(k, v) {
        if (!/^[A-Za-z0-9._-]+$/.test(k)) throw new Error('bad key ' + k);
        if (Buffer.byteLength(v) > 2048) throw new Error('value too large for ' + k);
        if (Buffer.from(v,'utf8').toString('utf8') !== v) throw new Error('lossy utf8 in ' + k); sets++; if (failOnSetNumber !== null && sets === failOnSetNumber) throw new Error('killed during write');
        data.set(k, v);
      },
      async remove(k) { if (!/^[A-Za-z0-9._-]+$/.test(k)) throw new Error('bad key ' + k); data.delete(k); },
    },
  };
}

const KEY = 'firebase:authUser:AIzaSyEXAMPLE:[DEFAULT]';
const session = (n, tag = 'a') => JSON.stringify({ uid: 'u1', email: 'a@b.al', stsTokenManager: { refreshToken: tag.repeat(n), accessToken: 'ë'.repeat(n) } });

(async () => {
  await check('round trip of a small value', async () => {
    const { raw } = fakeStore(); const s = createChunkedStorage(raw);
    await s.setItem(KEY, 'hello'); assert.strictEqual(await s.getItem(KEY), 'hello');
  });
  await check('round trip of a 5 KB session with accented characters under the 2 KB limit', async () => {
    const { raw } = fakeStore(); const s = createChunkedStorage(raw); const v = session(2500);
    assert.ok(v.length > 5000);
    await s.setItem(KEY, v); assert.strictEqual(await s.getItem(KEY), v); JSON.parse(await s.getItem(KEY));
  });
  await check('emoji and accents survive, even when a pair falls on a cut', async () => {
    for (const lead of [598, 599, 600, 601, 1199, 1200]) {
      const { raw } = fakeStore(); const s = createChunkedStorage(raw);
      const v = 'a'.repeat(lead) + '😀😀😀 Ëlda 👩‍⚕️ ' + 'ç'.repeat(700) + '😀'.repeat(400);
      await s.setItem(KEY, v); assert.strictEqual(await s.getItem(KEY), v, 'lead ' + lead);
    }
  });
  await check('an empty value round trips', async () => {
    const { raw } = fakeStore(); const s = createChunkedStorage(raw);
    await s.setItem(KEY, ''); assert.strictEqual(await s.getItem(KEY), '');
  });
  await check('a missing key reads as null', async () => {
    const { raw } = fakeStore(); const s = createChunkedStorage(raw);
    assert.strictEqual(await s.getItem(KEY), null);
  });
  await check('overwriting leaves no stale pieces behind', async () => {
    const { raw, data } = fakeStore(); const s = createChunkedStorage(raw);
    await s.setItem(KEY, session(3000)); const before = data.size;
    await s.setItem(KEY, 'short');
    assert.strictEqual(await s.getItem(KEY), 'short');
    assert.strictEqual(data.size, 2, 'expected the entry and one piece, got ' + [...data.keys()].join(','));
    assert.ok(before > 2);
  });
  await check('writing the same size twice keeps exactly one set', async () => {
    const { raw, data } = fakeStore(); const s = createChunkedStorage(raw);
    await s.setItem(KEY, session(2500, 'a')); const n = data.size;
    await s.setItem(KEY, session(2500, 'b'));
    assert.strictEqual(data.size, n); assert.ok((await s.getItem(KEY)).includes('b'));
  });
  await check('removeItem clears the entry and every piece', async () => {
    const { raw, data } = fakeStore(); const s = createChunkedStorage(raw);
    await s.setItem(KEY, session(3000)); await s.removeItem(KEY);
    assert.strictEqual(data.size, 0); assert.strictEqual(await s.getItem(KEY), null);
  });
  await check('removing a missing key does not fail', async () => {
    const { raw } = fakeStore(); const s = createChunkedStorage(raw); await s.removeItem(KEY);
  });
  await check('a lost piece reads as nothing saved, not as a broken value', async () => {
    const { raw, data } = fakeStore(); const s = createChunkedStorage(raw);
    await s.setItem(KEY, session(3000));
    const piece = [...data.keys()].find((k) => k.endsWith('.1')); data.delete(piece);
    assert.strictEqual(await s.getItem(KEY), null);
  });
  await check('a garbled entry reads as nothing saved', async () => {
    const { raw, data } = fakeStore(); const s = createChunkedStorage(raw);
    await s.setItem(KEY, 'x'); data.set('firebase_authUser_AIzaSyEXAMPLE__DEFAULT_', 'junk'); 
    assert.strictEqual(await s.getItem(KEY), null);
  });
  // Killing the app at every possible moment while replacing an old long session with a new long one:
  // what is read back must be the complete old value, the complete new value, or nothing, never a mix.
  const oldV = session(3000, 'o'); const newV = session(3000, 'n');
  let steps = 0;
  { const { raw } = fakeStore(); const s = createChunkedStorage(raw); await s.setItem(KEY, oldV); const probe = fakeStore(); const p = createChunkedStorage(probe.raw); await p.setItem(KEY, oldV); const base = 0; }
  for (let kill = 1; kill <= 14; kill++) {
    await check(`killed at write #${kill} while replacing a session: never a mix`, async () => {
      const store = fakeStore(); const s = createChunkedStorage(store.raw);
      await s.setItem(KEY, oldV);
      // Re-create with a failure injected into the NEXT writes only.
      let n = 0; const raw2 = { ...store.raw, async set(k, v) { n++; if (n === kill) throw new Error('killed'); return store.raw.set(k, v); } };
      const s2 = createChunkedStorage(raw2);
      try { await s2.setItem(KEY, newV); } catch {}
      const got = await createChunkedStorage(store.raw).getItem(KEY);
      assert.ok(got === oldV || got === newV || got === null, 'mixed value read back');
      if (got !== null) JSON.parse(got);
    });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
