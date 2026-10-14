import { pool } from "../db.js";

export async function insertSession(userId: string, tokenHash: Buffer, expiresAt: Date): Promise<void> {
  await pool.query(`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`, [
    userId,
    tokenHash,
    expiresAt,
  ]);
}

// One atomic statement: if the session is valid (not expired, not idle too long),
// bump last_seen_at and return its user_id. Otherwise returns undefined.
export async function touchValidSession(tokenHash: Buffer, idleDays: number): Promise<string | undefined> {
  const { rows } = await pool.query<{ user_id: string }>(
    `UPDATE sessions
        SET last_seen_at = now()
      WHERE token_hash = $1
        AND expires_at > now()
        AND last_seen_at > now() - make_interval(days => $2)
      RETURNING user_id`,
    [tokenHash, idleDays],
  );
  return rows[0]?.user_id;
}

export async function deleteSession(tokenHash: Buffer): Promise<void> {
  await pool.query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash]);
}
