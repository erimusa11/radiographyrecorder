/** What a person types into the product form. */
export interface StockFields {
  name: string;
  /** How many are in the store room now. */
  quantity: number;
  /** For example "kuti" or "copë". May be empty. */
  unit: string;
  /** When the quantity falls to this number (or below) the product is marked "Pak". 0 means: only warn when it runs out. */
  minQuantity: number;
}

/** A product in the store room. All times are milliseconds since 1970. */
export interface StockItem extends StockFields {
  id: string;
  createdAt: number;
  updatedAt: number;
}

/** What a person types for one line of the buy list. */
export interface BuyFields {
  name: string;
  /** How many to buy (at least 1). */
  quantity: number;
  /** For example "kuti" or "copë". May be empty. */
  unit: string;
}

/** One line of the "Lista për t'u blerë". */
export interface BuyItem extends BuyFields {
  id: string;
  /** True once it has been bought (it stays in the list, crossed out, until the bought ones are cleared). */
  done: boolean;
  createdAt: number;
  updatedAt: number;
}

export type StockLevel = 'ok' | 'low' | 'out';
