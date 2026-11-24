import type { BuyItem, StockItem, StockLevel } from '@/types/stock';

import { foldText } from './text';

/** The biggest quantity a product can hold. */
export const MAX_QUANTITY = 100_000;

/** Keeps only the digits of what was typed into a number field (at most 6, the length of the biggest quantity). */
export const digitsOnly = (text: string) => text.replace(/\D/g, '').slice(0, 6);

/** Reads a whole number from a text field. Returns null when the text is not a number from `min` to the maximum. */
export function parseQuantity(text: string, min = 0): number | null {
  const clean = text.trim();
  if (!/^\d+$/.test(clean)) return null;
  const value = Number(clean);
  return value >= min && value <= MAX_QUANTITY ? value : null;
}

/** `out` when nothing is left, `low` when the quantity has fallen to the minimum (if a minimum is set). */
export function stockLevel(item: Pick<StockItem, 'quantity' | 'minQuantity'>): StockLevel {
  if (item.quantity <= 0) return 'out';
  if (item.minQuantity > 0 && item.quantity <= item.minQuantity) return 'low';
  return 'ok';
}

/** A to Z, ignoring case and accents. */
export function sortStock(list: readonly StockItem[]): StockItem[] {
  return [...list].sort((a, b) => {
    const fa = foldText(a.name);
    const fb = foldText(b.name);
    return fa < fb ? -1 : fa > fb ? 1 : 0;
  });
}

/** Still to buy first, in the order they were added; the bought ones after them, newest first. */
export function sortBuy(list: readonly BuyItem[]): BuyItem[] {
  const open = list.filter((item) => !item.done).sort((a, b) => a.createdAt - b.createdAt);
  const done = list.filter((item) => item.done).sort((a, b) => b.updatedAt - a.updatedAt);
  return [...open, ...done];
}
