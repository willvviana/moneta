import { pool } from "../db.js";
import { toSafeCents } from "../money.js";

// THE definition of "spending" in Moneta, in one place:
//   spending = expense transactions, owned by the user, with date in [from, to).
// Income never counts. A transaction has one date, so it falls in exactly one period
// (no double counting). Budgets use this; the dashboard's expense total is an independent
// aggregate of the same rule, and a test proves the two reconcile.

// Total spent per category. Categories with no qualifying expenses are simply absent
// (callers treat "absent" as 0).
export async function spentByCategory(userId: string, from: string, to: string): Promise<Map<string, number>> {
  // SUM of BIGINT is NUMERIC in Postgres; ::text keeps it exact, then we convert deliberately.
  const { rows } = await pool.query<{ categoryId: string; spent: string }>(
    `SELECT category_id AS "categoryId", SUM(amount_cents)::text AS spent
       FROM transactions
      WHERE user_id = $1 AND type = 'expense' AND date >= $2 AND date < $3
      GROUP BY category_id`,
    [userId, from, to],
  );
  const result = new Map<string, number>();
  for (const row of rows) result.set(row.categoryId, toSafeCents(row.spent, "category spending"));
  return result;
}
