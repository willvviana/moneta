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

// Two writes that must succeed or fail TOGETHER: store the new hash AND delete every session of the user.
// If only the first happened, a stolen session would survive the password change; if only the second,
// the user would be logged out with the old password still valid. Hence one database transaction.
export async function setPasswordAndRevokeSessions(userId: string, passwordHash: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [userId, passwordHash]);
    await client.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function findUserById(id: string): Promise<PublicUser | undefined> {
  const { rows } = await pool.query<PublicUser>(`SELECT id, email FROM users WHERE id = $1`, [id]);
  return rows[0];
}
