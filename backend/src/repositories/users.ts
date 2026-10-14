import { pool } from "../db.js";

// Repository layer: SQL only, no business decisions.
// Note: pg returns BIGINT as strings, so ids are strings here.

export interface PublicUser {
  id: string;
  email: string;
}
export interface UserWithHash extends PublicUser {
  password_hash: string;
}

export async function insertUser(email: string, passwordHash: string): Promise<PublicUser> {
  const { rows } = await pool.query<PublicUser>(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email`,
    [email, passwordHash],
  );
  return rows[0]!;
}

export async function findUserByEmail(email: string): Promise<UserWithHash | undefined> {
  const { rows } = await pool.query<UserWithHash>(
    `SELECT id, email, password_hash FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
  return rows[0];
}

export async function findUserById(id: string): Promise<PublicUser | undefined> {
  const { rows } = await pool.query<PublicUser>(`SELECT id, email FROM users WHERE id = $1`, [id]);
  return rows[0];
}
