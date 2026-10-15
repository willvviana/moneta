import { api } from "./api";

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  spentCents: number;
}

export interface CategoryReport {
  from: string; // YYYY-MM, inclusive
  to: string; // YYYY-MM, inclusive
  totalSpentCents: number;
  categories: CategorySpending[]; // largest first; includes categories without a budget
}

export interface MonthRow {
  month: string; // YYYY-MM
  incomeCents: number;
  expensesCents: number;
  netCashFlowCents: number; // NOT an account balance
}

export interface OverTimeReport {
  from: string;
  to: string;
  months: MonthRow[]; // one per month in the range, zero rows included
  totals: { incomeCents: number; expensesCents: number; netCashFlowCents: number };
}

export const getSpendingByCategory = (from: string, to: string) =>
  api<{ report: CategoryReport }>(`/reports/spending-by-category?from=${from}&to=${to}`).then((r) => r.report);

export const getOverTime = (from: string, to: string) =>
  api<{ report: OverTimeReport }>(`/reports/over-time?from=${from}&to=${to}`).then((r) => r.report);
