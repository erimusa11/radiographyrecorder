import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import * as store from '@/lib/stock';
import type { BuyFields, BuyItem, StockFields, StockItem } from '@/types/stock';
import { dataErrorMessage } from '@/utils/dataErrors';
import { MAX_QUANTITY, sortBuy, sortStock } from '@/utils/stock';
import { cleanText, makeId, sameText } from '@/utils/text';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export interface SaveStockInput {
  fields: StockFields;
  /** Present when an existing product is being changed. */
  existing?: StockItem;
  /** For a new product: the id made when the form opened (kept on retries, so a retry never makes a second product). */
  draftId?: string;
}

interface StockContextValue {
  /** The products, A to Z. */
  stock: StockItem[];
  /** The "Lista për t'u blerë": still to buy first, bought ones after. */
  buy: BuyItem[];
  status: Status;
  /** True once the lists have been loaded at least once (so a refresh does not hide them). */
  loaded: boolean;
  error: string | null;
  /** Starts loading the lists the first time the Stock tab opens; later calls do nothing. */
  load: () => void;
  refresh: () => void;
  saveItem: (input: SaveStockInput) => Promise<StockItem>;
  /** The "+" and "−" buttons. The screen changes at once; the saving happens behind it. */
  adjust: (id: string, delta: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  /** Adds a line to the buy list. Returns `exists` when it is already waiting to be bought. */
  addToBuy: (name: string, quantity?: number, unit?: string) => Promise<'added' | 'exists'>;
  /** Changes the name, amount or unit of a line. */
  saveBuy: (id: string, fields: BuyFields) => Promise<void>;
  toggleBuy: (id: string) => Promise<void>;
  removeBuy: (id: string) => Promise<void>;
  /** Removes every line that has been bought. */
  clearBought: () => Promise<void>;
}

const StockContext = createContext<StockContextValue | null>(null);

export function StockProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [buy, setBuy] = useState<BuyItem[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wanted, setWanted] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // The latest lists, readable inside handlers without waiting for a re-render (quick taps follow each other).
  const stockRef = useRef<StockItem[]>(stock);
  const buyRef = useRef<BuyItem[]>(buy);

  const commitStock = useCallback((next: StockItem[]) => {
    stockRef.current = next;
    setStock(next);
  }, []);
  const commitBuy = useCallback((next: BuyItem[]) => {
    buyRef.current = next;
    setBuy(next);
  }, []);

  // Load when the Stock tab is first opened, and again on every refresh. Signing out forgets everything.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!user) {
        commitStock([]);
        commitBuy([]);
        setLoaded(false);
        setWanted(false);
        setStatus('idle');
        return;
      }
      if (!wanted) return;
      setStatus('loading');
      try {
        const [products, lines] = await Promise.all([store.listStock(user), store.listBuy(user)]);
        if (cancelled) return;
        commitStock(products);
        commitBuy(lines);
        setError(null);
        setLoaded(true);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setError(dataErrorMessage(e, 'load'));
        setStatus('error');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [user, wanted, reloadKey, commitStock, commitBuy]);

  const load = useCallback(() => setWanted(true), []);
  const refresh = useCallback(() => {
    setWanted(true);
    setReloadKey((key) => key + 1);
  }, []);

  const saveItem = useCallback(
    async ({ fields, existing, draftId }: SaveStockInput) => {
      if (!user) throw new Error('signed-out');
      let item: StockItem;
      if (existing) {
        item = { ...existing, ...fields, updatedAt: Date.now() };
        await store.updateStockItem(user, existing.id, fields);
      } else {
        if (!draftId) throw new Error('missing-draft');
        const now = Date.now();
        item = { id: draftId, ...fields, createdAt: now, updatedAt: now };
        await store.createStockItem(user, item);
      }
      commitStock(sortStock([item, ...stockRef.current.filter((i) => i.id !== item.id)]));
      return item;
    },
    [user, commitStock],
  );

  const adjust = useCallback(
    async (id: string, delta: number) => {
      if (!user) throw new Error('signed-out');
      const current = stockRef.current.find((i) => i.id === id);
      if (!current) return;
      const quantity = Math.min(MAX_QUANTITY, Math.max(0, current.quantity + delta));
      if (quantity === current.quantity) return;
      commitStock(stockRef.current.map((i) => (i.id === id ? { ...i, quantity, updatedAt: Date.now() } : i)));
      try {
        await store.setStockQuantity(user, id, quantity);
      } catch (e) {
        // Put back the number that was on screen before this tap.
        commitStock(stockRef.current.map((i) => (i.id === id ? { ...i, quantity: current.quantity } : i)));
        throw e;
      }
    },
    [user, commitStock],
  );

  const removeItem = useCallback(
    async (id: string) => {
      if (!user) throw new Error('signed-out');
      await store.deleteStockItem(user, id);
      commitStock(stockRef.current.filter((i) => i.id !== id));
    },
    [user, commitStock],
  );

  /** Changes one line. The screen shows the change at once; if saving fails the line goes back to how it was. */
  const patchBuy = useCallback(
    async (id: string, patch: Partial<BuyFields & { done: boolean }>) => {
      if (!user) throw new Error('signed-out');
      const before = buyRef.current.find((i) => i.id === id);
      if (!before) return;
      commitBuy(sortBuy(buyRef.current.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i))));
      try {
        await store.updateBuyItem(user, id, patch);
      } catch (e) {
        commitBuy(sortBuy(buyRef.current.map((i) => (i.id === id ? before : i))));
        throw e;
      }
    },
    [user, commitBuy],
  );

  const addToBuy = useCallback(
    async (rawName: string, quantity = 1, rawUnit = ''): Promise<'added' | 'exists'> => {
      if (!user) throw new Error('signed-out');
      const name = cleanText(rawName);
      if (!name) return 'exists';
      const unit = cleanText(rawUnit);
      const same = buyRef.current.find((i) => sameText(i.name, name));
      if (same) {
        if (!same.done) return 'exists';
        // It was bought before and is needed again: put the same line back in the list, with the new amount.
        await patchBuy(same.id, { quantity, unit, done: false });
        return 'added';
      }
      const now = Date.now();
      const item: BuyItem = { id: makeId(), name, quantity, unit, done: false, createdAt: now, updatedAt: now };
      commitBuy(sortBuy([...buyRef.current, item]));
      try {
        await store.createBuyItem(user, item);
      } catch (e) {
        commitBuy(buyRef.current.filter((i) => i.id !== item.id));
        throw e;
      }
      return 'added';
    },
    [user, commitBuy, patchBuy],
  );

  const saveBuy = useCallback((id: string, fields: BuyFields) => patchBuy(id, fields), [patchBuy]);

  const toggleBuy = useCallback(
    async (id: string) => {
      const item = buyRef.current.find((i) => i.id === id);
      if (item) await patchBuy(id, { done: !item.done });
    },
    [patchBuy],
  );

  const removeBuy = useCallback(
    async (id: string) => {
      if (!user) throw new Error('signed-out');
      await store.deleteBuyItems(user, [id]);
      commitBuy(buyRef.current.filter((i) => i.id !== id));
    },
    [user, commitBuy],
  );

  const clearBought = useCallback(async () => {
    if (!user) throw new Error('signed-out');
    const ids = buyRef.current.filter((i) => i.done).map((i) => i.id);
    await store.deleteBuyItems(user, ids);
    const gone = new Set(ids);
    commitBuy(buyRef.current.filter((i) => !gone.has(i.id)));
  }, [user, commitBuy]);

  const value = useMemo<StockContextValue>(
    () => ({ stock, buy, status, loaded, error, load, refresh, saveItem, adjust, removeItem, addToBuy, saveBuy, toggleBuy, removeBuy, clearBought }),
    [stock, buy, status, loaded, error, load, refresh, saveItem, adjust, removeItem, addToBuy, saveBuy, toggleBuy, removeBuy, clearBought],
  );

  return <StockContext.Provider value={value}>{children}</StockContext.Provider>;
}

export function useStock(): StockContextValue {
  const ctx = useContext(StockContext);
  if (!ctx) throw new Error('useStock must be used within a StockProvider');
  return ctx;
}
