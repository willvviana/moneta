// Column sorting. Pure functions so the rules are unit-tested. Sorting happens in the browser on rows
// already loaded; it never changes any amount. Array.prototype.sort is stable, so rows that compare
// equal keep the order the server sent them in.

import type { Transaction } from "./transactions";

export type SortDir = "asc" | "desc";
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

// Clicking the active column flips direction; clicking another column selects it with its natural first direction
// (numbers and dates: biggest/newest first; text: A to Z).
export function nextSort<K extends string>(current: SortState<K>, key: K, firstDir: SortDir): SortState<K> {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: firstDir };
}

const text = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

// ---- Names (categories list, budgets) ----------------------------------------------------------

export type NameSortKey = "name";
export const DEFAULT_NAME_SORT: SortState<NameSortKey> = { key: "name", dir: "asc" };

// Sorts any list by a name, ignoring case. Ties keep their original order.
export function sortByName<T>(rows: T[], nameOf: (row: T) => string, dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * text(nameOf(a), nameOf(b)));
}

// ---- Transactions ------------------------------------------------------------------------------

export type TxSortKey = "date" | "description" | "category" | "type" | "amount";
export const TX_FIRST_DIR: Record<TxSortKey, SortDir> = {
  date: "desc",
  description: "asc",
  category: "asc",
  type: "asc",
  amount: "desc",
};
export const DEFAULT_TX_SORT: SortState<TxSortKey> = { key: "date", dir: "desc" };

export function sortTransactions(
  txs: Transaction[],
  sort: SortState<TxSortKey>,
  categoryName: (id: string) => string,
): Transaction[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...txs].sort((a, b) => {
    switch (sort.key) {
      case "date":
        return sign * (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
      case "description": {
        // Empty descriptions always go last, whichever direction is chosen.
        if (a.description === "" || b.description === "") {
          return a.description === b.description ? 0 : a.description === "" ? 1 : -1;
        }
        return sign * text(a.description, b.description);
      }
      case "category":
        return sign * text(categoryName(a.categoryId), categoryName(b.categoryId));
      case "type":
        return sign * text(a.type, b.type);
      case "amount":
        return sign * (a.amountCents - b.amountCents); // unsigned size, regardless of income/expense
    }
  });
}

// ---- Category report ---------------------------------------------------------------------------

export type CategorySortKey = "category" | "spent" | "share";
export const CATEGORY_FIRST_DIR: Record<CategorySortKey, SortDir> = { category: "asc", spent: "desc", share: "desc" };
export const DEFAULT_CATEGORY_SORT: SortState<CategorySortKey> = { key: "spent", dir: "desc" };

interface CategoryRow {
  categoryName: string;
  spentCents: number;
}

// Share = spent / total, and the total is the same for every row, so ordering by share is ordering by spent.
export function sortCategoryRows<T extends CategoryRow>(rows: T[], sort: SortState<CategorySortKey>): T[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) =>
    sort.key === "category" ? sign * text(a.categoryName, b.categoryName) : sign * (a.spentCents - b.spentCents),
  );
}
