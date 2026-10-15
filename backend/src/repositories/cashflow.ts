import { pool } from "../db.js";
import { toSafeCents } from "../money.js";

// Income and expense totals for [from, to), in ONE aggregate query (no rows fetched).
// "Expense" here means the same thing as in spending.ts (type = 'expense'); the reconciliation
// test fails if the two ever disagree. An empty period yields 0 and 0, never NULL.
export async function cashflowTotals(
  userId: string,
  from: string,
  to: string,
): Promise<{ incomeCents: number; expensesCents: number }> {
  const { rows } = await pool.query<{ income: string; expenses: string }>(
    `SELECT COALESCE(SUM(amount_cents) FILTER (WHERE type = 'income'), 0)::text  AS income,
            COALESCE(SUM(amount_cents) FILTER (WHERE type = 'expense'), 0)::text AS expenses
       FROM transactions
      WHERE user_id = $1 AND date >= $2 AND date < $3`,
    [userId, from, to],
  );
  const row = rows[0]!; // an aggregate without GROUP BY always returns exactly one row
  return {
    incomeCents: toSafeCents(row.income, "income total"),
    expensesCents: toSafeCents(row.expenses, "expense total"),
  };
}
