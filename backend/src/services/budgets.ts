import { AppError, pgErrorCode } from "../errors.js";
import { monthBounds } from "../months.js";
import * as repo from "../repositories/budgets.js";
import { spentByCategory } from "../repositories/spending.js";

// Service layer: the budget BUSINESS RULE lives here.
//   remaining = limit - spent, and it may be negative (negative = over budget).
// Both inputs are non-negative safe integers, so the subtraction is exact.

export interface BudgetView extends repo.BudgetRecord {
  spentCents: number;
  remainingCents: number;
}

const toView = (b: repo.BudgetRecord, spent: Map<string, number>): BudgetView => {
  const spentCents = spent.get(b.categoryId) ?? 0; // no qualifying expenses = 0
  return { ...b, spentCents, remainingCents: b.limitCents - spentCents };
};

export async function list(userId: string, month: string): Promise<BudgetView[]> {
  const { from, to } = monthBounds(month);
  const [budgets, spent] = await Promise.all([repo.listBudgets(userId, from), spentByCategory(userId, from, to)]);
  return budgets.map((b) => toView(b, spent));
}

export async function set(userId: string, categoryId: string, month: string, limitCents: number): Promise<BudgetView> {
  const { from, to } = monthBounds(month);
  let budget: repo.BudgetRecord;
  try {
    budget = await repo.upsertBudget(userId, categoryId, from, limitCents);
  } catch (err) {
    // 23503: the composite FK says this category doesn't exist FOR THIS USER (missing or someone else's).
    if (pgErrorCode(err) === "23503") throw new AppError(400, "categoryId: category not found");
    throw err;
  }
  return toView(budget, await spentByCategory(userId, from, to));
}

export async function remove(userId: string, id: string): Promise<void> {
  if (!(await repo.deleteBudget(userId, id))) throw new AppError(404, "Budget not found");
}
