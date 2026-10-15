import { monthBounds } from "../months.js";
import { sumCents } from "../money.js";
import { cashflowTotals } from "../repositories/cashflow.js";
import * as budgets from "./budgets.js";

// Service layer: assembles the dashboard from the SAME rules used elsewhere.
//  - net cash flow = income - expenses (can be negative). It is NOT an account balance.
//  - budget figures come from the budgets service, so there is no second budget calculation.
//  - spentInBudgetedCategoriesCents counts only categories that HAVE a budget, so it can be lower
//    than expensesCents (which counts every category). Both are correct; they answer different questions.

export interface Dashboard {
  month: string;
  incomeCents: number;
  expensesCents: number;
  netCashFlowCents: number;
  budgets: {
    budgetCount: number;
    totalBudgetedCents: number;
    spentInBudgetedCategoriesCents: number;
    overBudgetCount: number;
  };
}

export async function get(userId: string, month: string): Promise<Dashboard> {
  const { from, to } = monthBounds(month);
  const [totals, monthBudgets] = await Promise.all([cashflowTotals(userId, from, to), budgets.list(userId, month)]);

  return {
    month,
    incomeCents: totals.incomeCents,
    expensesCents: totals.expensesCents,
    // Both are safe integers >= 0, so the difference is exact.
    netCashFlowCents: totals.incomeCents - totals.expensesCents,
    budgets: {
      budgetCount: monthBudgets.length,
      totalBudgetedCents: sumCents(monthBudgets.map((b) => b.limitCents), "total budgeted"),
      spentInBudgetedCategoriesCents: sumCents(monthBudgets.map((b) => b.spentCents), "budgeted spending"),
      overBudgetCount: monthBudgets.filter((b) => b.remainingCents < 0).length,
    },
  };
}
