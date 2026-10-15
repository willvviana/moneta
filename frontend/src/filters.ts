// Table filters. Pure functions (no React) so the rules are unit-tested. Filtering happens in the
// browser on rows already loaded from the API; the server's numbers are never recomputed here.

import type { Budget } from "./budgets";
import { parseDollarsToCents } from "./money";
import type { Transaction } from "./transactions";

// ---- Transactions ------------------------------------------------------------------------------

export interface TxFilters {
  type: "all" | "income" | "expense";
  categoryId: string; // "" = every category
  text: string; // case-insensitive "contains" on the description
  min: string; // dollars as typed ("12.34" or "12,34"); "" = no minimum
  max: string; // "" = no maximum
}

export const EMPTY_TX_FILTERS: TxFilters = { type: "all", categoryId: "", text: "", min: "", max: "" };

// "" means "no limit". Anything else must be a valid positive amount, parsed with the SAME
// rules as the amount field in the transaction form.
export function parseAmountFilter(text: string): { cents: number | null; valid: boolean } {
  if (text.trim() === "") return { cents: null, valid: true };
  const cents = parseDollarsToCents(text);
  return cents === null ? { cents: null, valid: false } : { cents, valid: true };
}

// A message when the amount filters can't be applied, otherwise null.
export function amountRangeProblem(min: string, max: string): string | null {
  const lo = parseAmountFilter(min);
  const hi = parseAmountFilter(max);
  if (!lo.valid || !hi.valid) return "Enter amounts greater than 0, like 12.34 or 12,34.";
  if (lo.cents !== null && hi.cents !== null && lo.cents > hi.cents) return "The minimum can't be higher than the maximum.";
  return null;
}

export function hasActiveTxFilters(f: TxFilters): boolean {
  return f.type !== "all" || f.categoryId !== "" || f.text.trim() !== "" || f.min.trim() !== "" || f.max.trim() !== "";
}

export function filterTransactions(txs: Transaction[], f: TxFilters): Transaction[] {
  const text = f.text.trim().toLowerCase();
  // If the amount filters are invalid or inverted the UI shows the error and the amount filter is
  // ignored, so a typo doesn't silently empty the table.
  const amountsOk = amountRangeProblem(f.min, f.max) === null;
  const min = amountsOk ? parseAmountFilter(f.min).cents : null;
  const max = amountsOk ? parseAmountFilter(f.max).cents : null;

  return txs.filter(
    (tx) =>
      (f.type === "all" || tx.type === f.type) &&
      (f.categoryId === "" || tx.categoryId === f.categoryId) &&
      (text === "" || tx.description.toLowerCase().includes(text)) &&
      (min === null || tx.amountCents >= min) && // inclusive
      (max === null || tx.amountCents <= max), // inclusive
  );
}

// ---- Names (categories list, category report) --------------------------------------------------

export function matchesName(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === "" || name.toLowerCase().includes(q);
}

// ---- Budgets -----------------------------------------------------------------------------------

export type BudgetStatus = "all" | "over" | "within";

// "over" = spending is above the limit (the same rule as the red bar and "Over by $X").
// "within" includes a budget that is exactly at its limit.
export function filterBudgets(budgets: Budget[], status: BudgetStatus): Budget[] {
  if (status === "over") return budgets.filter((b) => b.remainingCents < 0);
  if (status === "within") return budgets.filter((b) => b.remainingCents >= 0);
  return budgets;
}
