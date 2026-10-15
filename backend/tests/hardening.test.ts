import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it, vi } from "vitest";
// vi.hoisted runs before the imports below, so the limiter is created with limit 10.
vi.hoisted(() => {
  process.env.REGISTER_RATE_LIMIT = "10";
});

import { app } from "../src/app.js";
import { pool } from "../src/db.js";
import { safeLogDetails } from "../src/errors.js";
import { deleteExpiredSessions } from "../src/repositories/sessions.js";

// Every email and password is generated at runtime: no credential literal exists in this file.
const createdEmails: string[] = [];

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE email = ANY($1)`, [createdEmails]);
  await pool.end();
});

describe("security headers", () => {
  it("sends helmet's headers and hides X-Powered-By", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors");
  });
});

describe("POST /api/auth/register rate limit", () => {
  it("allows 10 registrations per IP per window, then answers 429", async () => {
    const attempt = async () => {
      const email = `hard-${randomUUID()}@example.test`;
      createdEmails.push(email);
      return request(app).post("/api/auth/register").send({ email, password: randomBytes(18).toString("base64url") });
    };
    for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe(201);
    expect((await attempt()).status).toBe(429);
  });
});

describe("safeLogDetails", () => {
  it("keeps the SQLSTATE code and message but drops pg's `detail` (it contains user data)", () => {
    const err = Object.assign(new Error("duplicate key value violates unique constraint"), {
      code: "23505",
      detail: "Key (email)=(someone@example.test) already exists.",
    });
    const logged = safeLogDetails(err);
    expect(logged.code).toBe("23505");
    expect(JSON.stringify(logged)).not.toContain("someone@example.test");
  });
});

describe("deleteExpiredSessions", () => {
  it("removes expired sessions and keeps live ones", async () => {
    const email = `hard-${randomUUID()}@example.test`;
    createdEmails.push(email);
    const { rows } = await pool.query<{ id: string }>(`INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id`, [email]);
    const userId = rows[0]!.id;
    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() - interval '1 day'), ($1, $3, now() + interval '1 day')`,
      [userId, randomBytes(32), randomBytes(32)],
    );
    expect(await deleteExpiredSessions()).toBeGreaterThanOrEqual(1);
    const left = await pool.query(`SELECT count(*)::int AS n FROM sessions WHERE user_id = $1`, [userId]);
    expect(left.rows[0].n).toBe(1);
  });
});
