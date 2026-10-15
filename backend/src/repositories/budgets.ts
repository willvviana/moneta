import { pool } from "../db.js";

// RULE: every function takes userId FIRST and filters by it.

export interface BudgetRecord {
  id: string;
  categoryId: string;
  month: string; // YYYY-MM
  limitCents: number;
}

interface Row extends Omit<BudgetRecord, "limitCents"> {
  limitCents: string; // BIGINT arrives as a string
}
const toRecord = (r: Row): BudgetRecord => ({ ...r, limitCents: Number(r.limitCents) });

const COLUMNS = `id, category_id AS "categoryId", to_char(month, 'YYYY-MM') AS month, limit_cents AS "limitCents"`;

// monthStart is the first day of the month, e.g. "2026-10-01".
export async function listBudgets(userId: string, monthStart: string): Promise<BudgetRecord[]> {
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM budgets WHERE user_id = $1 AND month = $2 ORDER BY id`,
    [userId, monthStart],
  );
  return rows.map(toRecord);
}

// Create, or replace the limit if this category already has a budget for the month.
// A foreign key violation (23503) means the category isn't this user's.
export async function upsertBudget(
  userId: string,
  categoryId: string,
  monthStart: string,
  limitCents: number,
): Promise<BudgetRecord> {
  const { rows } = await pool.query<Row>(
    `INSERT INTO budgets (user_id, category_id, month, limit_cents)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, category_id, month)
     DO UPDATE SET limit_cents = EXCLUDED.limit_cents, updated_at = now()
     RETURNING ${COLUMNS}`,
    [userId, categoryId, monthStart, limitCents],
  );
  return toRecord(rows[0]!);
}

export async function deleteBudget(userId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM budgets WHERE id = $2 AND user_id = $1`, [userId, id]);
  return (rowCount ?? 0) > 0;
}
