import { pool } from "../db.js";
import { toSafeCents } from "../money.js";

export interface MonthlyRow {
  month: string; // YYYY-MM
  incomeCents: number;
  expensesCents: number;
}

// One row per calendar month from `fromMonth` to `toMonth` INCLUSIVE, including months with no
// transactions (zeros), so charts have no gaps. Aggregation happens in SQL; no rows are fetched.
// generate_series runs on plain `timestamp` (no time zone) and is cast back to date for the join,
// so the month boundaries cannot shift with the server's time zone.
export async function monthlyCashflow(userId: string, fromMonth: string, toMonth: string): Promise<MonthlyRow[]> {
  const { rows } = await pool.query<{ month: string; income: string; expenses: string }>(
    `SELECT to_char(m.month, 'YYYY-MM') AS month,
            COALESCE(SUM(t.amount_cents) FILTER (WHERE t.type = 'income'), 0)::text  AS income,
            COALESCE(SUM(t.amount_cents) FILTER (WHERE t.type = 'expense'), 0)::text AS expenses
       FROM generate_series($2::timestamp, $3::timestamp, interval '1 month') AS m(month)
       LEFT JOIN transactions t
              ON t.user_id = $1
             AND t.date >= m.month::date
             AND t.date <  (m.month + interval '1 month')::date
      GROUP BY m.month
      ORDER BY m.month`,
    [userId, `${fromMonth}-01`, `${toMonth}-01`],
  );
  return rows.map((r) => ({
    month: r.month,
    incomeCents: toSafeCents(r.income, "monthly income"),
    expensesCents: toSafeCents(r.expenses, "monthly expenses"),
  }));
}
