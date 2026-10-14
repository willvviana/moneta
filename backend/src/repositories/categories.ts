import { pool } from "../db.js";

// RULE: every function takes userId FIRST and filters by it. TypeScript will not
// compile a call that forgets it.

export interface Category {
  id: string;
  name: string;
}

export async function listCategories(userId: string): Promise<Category[]> {
  const { rows } = await pool.query<Category>(
    `SELECT id, name FROM categories WHERE user_id = $1 ORDER BY name`,
    [userId],
  );
  return rows;
}

export async function insertCategory(userId: string, name: string): Promise<Category> {
  const { rows } = await pool.query<Category>(
    `INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING id, name`,
    [userId, name],
  );
  return rows[0]!;
}

export async function renameCategory(userId: string, id: string, name: string): Promise<Category | undefined> {
  const { rows } = await pool.query<Category>(
    `UPDATE categories SET name = $3 WHERE id = $2 AND user_id = $1 RETURNING id, name`,
    [userId, id, name],
  );
  return rows[0];
}

// Returns false when no row matched (missing OR someone else's: indistinguishable on purpose).
export async function deleteCategory(userId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM categories WHERE id = $2 AND user_id = $1`, [userId, id]);
  return (rowCount ?? 0) > 0;
}
