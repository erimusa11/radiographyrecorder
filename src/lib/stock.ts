import {
  collection,
  deleteDoc,
  doc,
  type DocumentData,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { firestore, isLocal, millis, READ_TIMEOUT_MS, readLocal, updateLocal, WRITE_TIMEOUT_MS } from '@/lib/storage';
import type { BuyFields, BuyItem, StockFields, StockItem } from '@/types/stock';
import type { AppUser } from '@/types/user';
import { sortBuy, sortStock } from '@/utils/stock';
import { withTimeout } from '@/utils/withTimeout';

// Where things live in Firestore: the products in /stock/{id}, the "Lista për t'u blerë" in /shopping/{id}.
const STOCK = 'stock';
const SHOPPING = 'shopping';
const LIST_LIMIT = 1000;
/** Firestore allows at most 500 writes in one batch. */
const BATCH_SIZE = 400;

// The development demo account keeps its data on this device only (see storage.ts).
const LOCAL_STOCK = 'rr.demo.stock.v1';
const LOCAL_BUY = 'rr.demo.shopping.v1';

function stockFromDoc(id: string, data: DocumentData): StockItem {
  return {
    id,
    name: String(data.name ?? ''),
    quantity: Number(data.quantity ?? 0),
    unit: String(data.unit ?? ''),
    minQuantity: Number(data.minQuantity ?? 0),
    createdAt: millis(data.createdAt),
    updatedAt: millis(data.updatedAt),
  };
}

function buyFromDoc(id: string, data: DocumentData): BuyItem {
  return {
    id,
    name: String(data.name ?? ''),
    // Lines saved before the amount existed count as 1.
    quantity: Math.max(1, Number(data.quantity ?? 1)),
    unit: String(data.unit ?? ''),
    done: data.done === true,
    createdAt: millis(data.createdAt),
    updatedAt: millis(data.updatedAt),
  };
}

/** The same fix for the local copy: older lines have no amount yet. */
const withAmount = (item: BuyItem): BuyItem => ({ ...item, quantity: Math.max(1, Number(item.quantity ?? 1)), unit: item.unit ?? '' });

// ---------- Stoku ----------

export async function listStock(user: AppUser): Promise<StockItem[]> {
  if (isLocal(user)) return sortStock(await readLocal<StockItem[]>(LOCAL_STOCK, []));
  const snapshot = await withTimeout(getDocs(query(collection(firestore(), STOCK), limit(LIST_LIMIT))), READ_TIMEOUT_MS);
  return sortStock(snapshot.docs.map((d) => stockFromDoc(d.id, d.data())));
}

/** Writes a new product. The id comes from the form and stays the same on a retry, so saving twice never makes two. */
export async function createStockItem(user: AppUser, item: StockItem): Promise<void> {
  if (isLocal(user)) {
    await updateLocal<StockItem[]>(LOCAL_STOCK, [], (all) => [item, ...all.filter((i) => i.id !== item.id)]);
    return;
  }
  // `updatedAt` inside `fields` is replaced by the server's time below.
  const { id, createdAt, ...fields } = item;
  await withTimeout(
    setDoc(doc(firestore(), STOCK, id), {
      ...fields,
      createdAt: Timestamp.fromMillis(createdAt),
      updatedAt: serverTimestamp(),
      createdBy: user.uid,
      updatedBy: user.uid,
    }),
    WRITE_TIMEOUT_MS,
  );
}

export async function updateStockItem(user: AppUser, id: string, fields: StockFields): Promise<void> {
  if (isLocal(user)) {
    await updateLocal<StockItem[]>(LOCAL_STOCK, [], (all) => all.map((i) => (i.id === id ? { ...i, ...fields, updatedAt: Date.now() } : i)));
    return;
  }
  await withTimeout(updateDoc(doc(firestore(), STOCK, id), { ...fields, updatedAt: serverTimestamp(), updatedBy: user.uid }), WRITE_TIMEOUT_MS);
}

/** The quick "+" and "−" buttons: changes only the quantity. */
export async function setStockQuantity(user: AppUser, id: string, quantity: number): Promise<void> {
  if (isLocal(user)) {
    await updateLocal<StockItem[]>(LOCAL_STOCK, [], (all) => all.map((i) => (i.id === id ? { ...i, quantity, updatedAt: Date.now() } : i)));
    return;
  }
  await withTimeout(updateDoc(doc(firestore(), STOCK, id), { quantity, updatedAt: serverTimestamp(), updatedBy: user.uid }), WRITE_TIMEOUT_MS);
}

export async function deleteStockItem(user: AppUser, id: string): Promise<void> {
  if (isLocal(user)) {
    await updateLocal<StockItem[]>(LOCAL_STOCK, [], (all) => all.filter((i) => i.id !== id));
    return;
  }
  await withTimeout(deleteDoc(doc(firestore(), STOCK, id)), WRITE_TIMEOUT_MS);
}

// ---------- Lista për t'u blerë ----------

export async function listBuy(user: AppUser): Promise<BuyItem[]> {
  if (isLocal(user)) return sortBuy((await readLocal<BuyItem[]>(LOCAL_BUY, [])).map(withAmount));
  const snapshot = await withTimeout(getDocs(query(collection(firestore(), SHOPPING), limit(LIST_LIMIT))), READ_TIMEOUT_MS);
  return sortBuy(snapshot.docs.map((d) => buyFromDoc(d.id, d.data())));
}

export async function createBuyItem(user: AppUser, item: BuyItem): Promise<void> {
  if (isLocal(user)) {
    await updateLocal<BuyItem[]>(LOCAL_BUY, [], (all) => [...all.filter((i) => i.id !== item.id), item]);
    return;
  }
  const { id, createdAt, ...fields } = item;
  await withTimeout(
    setDoc(doc(firestore(), SHOPPING, id), {
      ...fields,
      createdAt: Timestamp.fromMillis(createdAt),
      updatedAt: serverTimestamp(),
      createdBy: user.uid,
      updatedBy: user.uid,
    }),
    WRITE_TIMEOUT_MS,
  );
}

/** Changes a line: its name, amount or unit, or ticks it ("bought") or un-ticks it ("still to buy"). */
export async function updateBuyItem(user: AppUser, id: string, patch: Partial<BuyFields & { done: boolean }>): Promise<void> {
  if (isLocal(user)) {
    await updateLocal<BuyItem[]>(LOCAL_BUY, [], (all) => all.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i)));
    return;
  }
  await withTimeout(updateDoc(doc(firestore(), SHOPPING, id), { ...patch, updatedAt: serverTimestamp(), updatedBy: user.uid }), WRITE_TIMEOUT_MS);
}

export async function deleteBuyItems(user: AppUser, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  if (isLocal(user)) {
    const gone = new Set(ids);
    await updateLocal<BuyItem[]>(LOCAL_BUY, [], (all) => all.filter((i) => !gone.has(i.id)));
    return;
  }
  const db = firestore();
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const id of ids.slice(start, start + BATCH_SIZE)) batch.delete(doc(db, SHOPPING, id));
    await withTimeout(batch.commit(), WRITE_TIMEOUT_MS);
  }
}
