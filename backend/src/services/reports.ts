import { sumCents } from "../money.js";
import { rangeBounds } from "../months.js";
import * as categories from "../repositories/categories.js";
import { monthlyCashflow } from "../repositories/reports.js";
import { spentByCategory } from "../repositories/spending.js";

// Service layer for reports. Both reports cover the same inclusive month range and the same
// rule as the dashboard and budgets (expenses are type = 'expense'; income is never spending).

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  spentCents: number;
}

// Every category with expenses in the range, budgeted or not, largest first
// (ties broken by name so the order is stable).
export async function spendingByCategory(userId: string, fromMonth: string, toMonth: string) {
  const { from, to } = rangeBounds(fromMonth, toMonth);
  const [spent, allCategories] = await Promise.all([spentByCategory(userId, from, to), categories.listCategories(userId)]);

  const rows: CategorySpending[] = allCategories
    .filter((c) => spent.has(c.id))
    .map((c) => ({ categoryId: c.id, categoryName: c.name, spentCents: spent.get(c.id)! }))
    .sort((a, b) => b.spentCents - a.spentCents || a.categoryName.localeCompare(b.categoryName));

  return {
    from: fromMonth,
    to: toMonth,
    totalSpentCents: sumCents(rows.map((r) => r.spentCents), "total spending"),
    categories: rows,
  };
}

export async function overTime(userId: string, fromMonth: string, toMonth: string) {
  const rows = await monthlyCashflow(userId, fromMonth, toMonth);
  const months = rows.map((r) => ({
    month: r.month,
    incomeCents: r.incomeCents,
    expensesCents: r.expensesCents,
    netCashFlowCents: r.incomeCents - r.expensesCents, // both >= 0 safe integers: exact; may be negative
  }));
  const incomeCents = sumCents(rows.map((r) => r.incomeCents), "income total");
  const expensesCents = sumCents(rows.map((r) => r.expensesCents), "expense total");
  return {
    from: fromMonth,
    to: toMonth,
    months,
    totals: { incomeCents, expensesCents, netCashFlowCents: incomeCents - expensesCents },
  };
}
