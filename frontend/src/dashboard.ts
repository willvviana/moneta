import { api } from "./api";

export interface Dashboard {
  month: string;
  incomeCents: number;
  expensesCents: number; // ALL expenses in the month, every category
  netCashFlowCents: number; // income - expenses; NOT an account balance
  budgets: {
    budgetCount: number;
    totalBudgetedCents: number;
    // Only categories that HAVE a budget. Can be lower than expensesCents.
    spentInBudgetedCategoriesCents: number;
    overBudgetCount: number;
  };
}

export const getDashboard = (month: string) =>
  api<{ dashboard: Dashboard }>(`/dashboard?month=${month}`).then((r) => r.dashboard);
