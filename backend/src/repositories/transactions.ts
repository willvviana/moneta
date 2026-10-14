import { pool } from "../db.js";

// RULE: every function takes userId FIRST and filters by it.

export type TxType = "income" | "expense";

export interface Transaction {
  id: string;
  categoryId: string;
  type: TxType;
  amountCents: number;
  date: string; // YYYY-MM-DD
  description: string;
  createdAt: Date;
}

export interface NewTransaction {
  categoryId: string;
  type: TxType;
  amountCents: number;
  date: string;
  description?: string;
}
// A patch may contain only these fields. userId is deliberately NOT here.
export type TransactionPatch = Partial<NewTransaction>;

// to_char: pg would otherwise turn DATE into a JS Date at local midnight, and the
// JSON could come out a day off depending on the server's time zone.
const COLUMNS = `id, category_id AS "categoryId", type, amount_cents AS "amountCents",
                 to_char(date, 'YYYY-MM-DD') AS date, description, created_at AS "createdAt"`;

interface Row extends Omit<Transaction, "amountCents"> {
  amountCents: string; // BIGINT arrives as a string
}
// Safe: values were validated as safe integers on the way in.
const toTransaction = (r: Row): Transaction => ({ ...r, amountCents: Number(r.amountCents) });

// Half-open range [from, to).
export async function listTransactions(userId: string, from: string, to: string): Promise<Transaction[]> {
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM transactions
      WHERE user_id = $1 AND date >= $2 AND date < $3
      ORDER BY transactions.date DESC, id DESC`,
    [userId, from, to],
  );
  return rows.map(toTransaction);
}

export async function insertTransaction(userId: string, t: NewTransaction): Promise<Transaction> {
  const { rows } = await pool.query<Row>(
    `INSERT INTO transactions (user_id, category_id, type, amount_cents, date, description)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
    [userId, t.categoryId, t.type, t.amountCents, t.date, t.description ?? ""],
  );
  return toTransaction(rows[0]!);
}

// Column names come from this fixed map, NEVER from the client's keys.
const PATCHABLE: Record<keyof TransactionPatch, string> = {
  categoryId: "category_id",
  type: "type",
  amountCents: "amount_cents",
  date: "date",
  description: "description",
};

export async function updateTransaction(
  userId: string,
  id: string,
  patch: TransactionPatch,
): Promise<Transaction | undefined> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of Object.keys(PATCHABLE) as (keyof TransactionPatch)[]) {
    const value = patch[key];
    if (value === undefined) continue; // field not in the patch: leave unchanged
    values.push(value);
    sets.push(`${PATCHABLE[key]} = $${values.length}`);
  }
  if (sets.length === 0) return undefined; // callers validate non-empty patches
  values.push(id, userId);
  const { rows } = await pool.query<Row>(
    `UPDATE transactions SET ${sets.join(", ")}
      WHERE id = $${values.length - 1} AND user_id = $${values.length}
      RETURNING ${COLUMNS}`,
    values,
  );
  return rows[0] ? toTransaction(rows[0]) : undefined;
}

export async function deleteTransaction(userId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM transactions WHERE id = $2 AND user_id = $1`, [userId, id]);
  return (rowCount ?? 0) > 0;
}
