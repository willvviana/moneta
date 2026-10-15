import { api } from "./api";

export interface Budget {
  id: string;
  categoryId: string;
  month: string; // YYYY-MM
  limitCents: number;
  spentCents: number; // computed by the server: expense transactions in this category and month
  remainingCents: number; // limit - spent; NEGATIVE means over budget
}

export const listBudgets = (month: string) =>
  api<{ budgets: Budget[] }>(`/budgets?month=${month}`).then((r) => r.budgets);

// Create-or-replace: sets the limit for this category in this month.
export const setBudget = (categoryId: string, month: string, limitCents: number) =>
  api<{ budget: Budget }>("/budgets", { method: "PUT", body: { categoryId, month, limitCents } }).then((r) => r.budget);

export const deleteBudget = (id: string) => api<void>(`/budgets/${id}`, { method: "DELETE" });
