// Tests for firestore.rules, run against the local Firestore emulator (58 checks). Not part of the app or its build.
//
// Needs Java (Android Studio's bundled one works). To run, in an empty temporary folder:
//   npm init -y && npm i @firebase/rules-unit-testing@5 firebase@12 firebase-tools@14
//   copy this file and firestore.rules into that folder, then:
//   npx firebase emulators:exec --only firestore --project rr-rules-test "node firestore-rules.test.mjs firestore.rules"
// Re-run it every time firestore.rules changes, before publishing the rules.
import fs from 'node:fs';

import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, setLogLevel, updateDoc } from 'firebase/firestore';

setLogLevel('error');

const RULES = process.argv[2];
const env = await initializeTestEnvironment({
  projectId: 'rr-rules-test',
  firestore: { rules: fs.readFileSync(RULES, 'utf8') },
});

const now = new Date();
const later = new Date(now.getTime() + 60_000);

const rec = (uid, over = {}) => ({
  fullName: 'Ana Hoxha', idNumber: 'K123', residence: 'Shijak', age: 30, referringDoctor: 'Dr. Leka',
  examType: 'Gjoksi', filmType: '24 x 30 cm', examAt: now, createdAt: now, updatedAt: now, createdBy: uid, updatedBy: uid, ...over,
});
const stock = (uid, over = {}) => ({
  name: 'Film', quantity: 5, unit: 'kuti', minQuantity: 2, createdAt: now, updatedAt: now, createdBy: uid, updatedBy: uid, ...over,
});
const buy = (uid, over = {}) => ({
  name: 'Gjel', quantity: 2, unit: 'copë', done: false, createdAt: now, updatedAt: now, createdBy: uid, updatedBy: uid, ...over,
});

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'staff/staff1'), { active: true });
  await setDoc(doc(db, 'radiographs/r1'), rec('staff1'));
  await setDoc(doc(db, 'stock/s1'), stock('staff1'));
  // A line saved before the amount existed: no quantity, no unit.
  await setDoc(doc(db, 'shopping/b1'), { name: 'Vjetër', done: false, createdAt: now, updatedAt: now, createdBy: 'staff1', updatedBy: 'staff1' });
  await setDoc(doc(db, 'settings/options'), { examTypes: ['Gjoksi'], filmTypes: ['24 x 30 cm'], doctors: [] });
});

const staff = env.authenticatedContext('staff1').firestore();
const outsider = env.authenticatedContext('outsider').firestore();
const anon = env.unauthenticatedContext().firestore();

let pass = 0;
let fail = 0;
async function check(name, run) {
  try {
    await run();
    pass += 1;
    console.log('PASS', name);
  } catch (error) {
    fail += 1;
    console.log('FAIL', name, '->', String(error.message).split('\n')[0]);
  }
}
const ok = (name, fn) => check(name, () => assertSucceeds(fn()));
const no = (name, fn) => check(name, () => assertFails(fn()));

// --- who gets in
for (const path of ['radiographs/r1', 'stock/s1', 'shopping/b1', 'settings/options']) {
  await no(`anonymous cannot read ${path}`, () => getDoc(doc(anon, path)));
  await no(`signed-in non-staff cannot read ${path}`, () => getDoc(doc(outsider, path)));
  await ok(`staff can read ${path}`, () => getDoc(doc(staff, path)));
}
await no('anonymous cannot list radiographs', () => getDocs(collection(anon, 'radiographs')));
await no('non-staff cannot list radiographs', () => getDocs(collection(outsider, 'radiographs')));
await ok('staff can list radiographs', () => getDocs(collection(staff, 'radiographs')));
await no('non-staff cannot create a record', () => setDoc(doc(outsider, 'radiographs/x1'), rec('outsider')));
await no('non-staff cannot delete a record', () => deleteDoc(doc(outsider, 'radiographs/r1')));
await no('non-staff cannot change the lists', () => setDoc(doc(outsider, 'settings/options'), { examTypes: [], filmTypes: [], doctors: [] }));

// --- the staff list itself
await no('staff cannot read the staff list', () => getDoc(doc(staff, 'staff/staff1')));
await no('non-staff cannot add themselves to staff', () => setDoc(doc(outsider, 'staff/outsider'), { active: true }));
await no('staff cannot add someone to staff', () => setDoc(doc(staff, 'staff/friend'), { active: true }));
await no('staff cannot list the staff collection', () => getDocs(collection(staff, 'staff')));

// --- records
await ok('staff can create a valid record', () => setDoc(doc(staff, 'radiographs/a1b2c3d4'), rec('staff1')));
await no('record with an extra field is refused', () => setDoc(doc(staff, 'radiographs/x2'), rec('staff1', { admin: true })));
await no('record with age 121 is refused', () => setDoc(doc(staff, 'radiographs/x3'), rec('staff1', { age: 121 })));
await no('record with a one-word name of 2 letters is refused', () => setDoc(doc(staff, 'radiographs/x4'), rec('staff1', { fullName: 'Al' })));
await no('record with a name of 121 characters is refused', () => setDoc(doc(staff, 'radiographs/x5'), rec('staff1', { fullName: 'a'.repeat(121) })));
await no('record claiming another creator is refused', () => setDoc(doc(staff, 'radiographs/x6'), rec('someone-else')));
await no('record with a text age is refused', () => setDoc(doc(staff, 'radiographs/x7'), rec('staff1', { age: '30' })));
await no('record with an empty exam type is refused', () => setDoc(doc(staff, 'radiographs/x8'), rec('staff1', { examType: '' })));
await no('record id with a dot is refused', () => setDoc(doc(staff, 'radiographs/bad.id'), rec('staff1')));
await no('record id of 65 characters is refused', () => setDoc(doc(staff, `radiographs/${'a'.repeat(65)}`), rec('staff1')));
await ok('staff can change the name of a record', () => updateDoc(doc(staff, 'radiographs/r1'), { fullName: 'Ana Leka', updatedAt: later, updatedBy: 'staff1' }));
await no('exam date cannot be changed', () => updateDoc(doc(staff, 'radiographs/r1'), { examAt: later, updatedAt: later, updatedBy: 'staff1' }));
await no('creation time cannot be changed', () => updateDoc(doc(staff, 'radiographs/r1'), { createdAt: later, updatedAt: later, updatedBy: 'staff1' }));
await no('creator cannot be changed', () => updateDoc(doc(staff, 'radiographs/r1'), { createdBy: 'staff2', updatedAt: later, updatedBy: 'staff1' }));
await no('an update cannot claim another editor', () => updateDoc(doc(staff, 'radiographs/r1'), { updatedAt: later, updatedBy: 'staff2' }));
await ok('staff can delete a record', () => deleteDoc(doc(staff, 'radiographs/a1b2c3d4')));

// --- stock
await ok('staff can create a stock item', () => setDoc(doc(staff, 'stock/n1'), stock('staff1')));
await no('negative stock quantity is refused', () => setDoc(doc(staff, 'stock/n2'), stock('staff1', { quantity: -1 })));
await no('stock quantity above 100000 is refused', () => setDoc(doc(staff, 'stock/n3'), stock('staff1', { quantity: 100001 })));
await no('stock quantity with decimals is refused', () => setDoc(doc(staff, 'stock/n4'), stock('staff1', { quantity: 1.5 })));
await ok('staff can change a stock quantity', () => updateDoc(doc(staff, 'stock/s1'), { quantity: 4, updatedAt: later, updatedBy: 'staff1' }));
await no('stock creator cannot be changed', () => updateDoc(doc(staff, 'stock/s1'), { createdBy: 'staff2', updatedAt: later, updatedBy: 'staff1' }));
await no('non-staff cannot change stock', () => updateDoc(doc(outsider, 'stock/s1'), { quantity: 0, updatedAt: later, updatedBy: 'outsider' }));
await ok('staff can delete a stock item', () => deleteDoc(doc(staff, 'stock/n1')));

// --- buy list
await ok('staff can add a buy line', () => setDoc(doc(staff, 'shopping/m1'), buy('staff1')));
await no('buy line with quantity 0 is refused', () => setDoc(doc(staff, 'shopping/m2'), buy('staff1', { quantity: 0 })));
await no('buy line with a non-boolean done is refused', () => setDoc(doc(staff, 'shopping/m3'), buy('staff1', { done: 'yes' })));
await no('buy line with an empty name is refused', () => setDoc(doc(staff, 'shopping/m4'), buy('staff1', { name: '' })));
await ok('an old buy line without an amount can be ticked', () => updateDoc(doc(staff, 'shopping/b1'), { done: true, updatedAt: later, updatedBy: 'staff1' }));
await ok('staff can delete a buy line', () => deleteDoc(doc(staff, 'shopping/m1')));

// --- saved lists
await ok('staff can save the lists', () => setDoc(doc(staff, 'settings/options'), { examTypes: ['A'], filmTypes: ['B'], doctors: ['C'] }));
await no('lists with an unknown key are refused', () => setDoc(doc(staff, 'settings/options'), { examTypes: [], filmTypes: [], doctors: [], extra: 1 }));
await no('a list of 201 exam types is refused', () => setDoc(doc(staff, 'settings/options'), { examTypes: Array(201).fill('x'), filmTypes: [], doctors: [] }));
await no('another settings document is refused', () => setDoc(doc(staff, 'settings/other'), { a: 1 }));

// --- anything else
await no('an unknown collection is closed even for staff (read)', () => getDoc(doc(staff, 'secrets/one')));
await no('an unknown collection is closed even for staff (write)', () => setDoc(doc(staff, 'secrets/one'), { a: 1 }));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
