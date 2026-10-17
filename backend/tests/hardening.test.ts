import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
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
    const limited = await attempt();
    expect(limited.status).toBe(429);
    // Same { error, code } shape as every other API error, so the client can translate it.
    expect(limited.body).toEqual({ error: "Too many attempts. Try again later.", code: "RATE_LIMITED" });
  });
});

describe("error responses carry a machine-readable code", () => {
  it("unknown API path", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found", code: "NOT_FOUND" });
  });

  it("not authenticated", async () => {
    const res = await request(app).get("/api/transactions?from=2026-01-01&to=2026-02-01");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("NOT_AUTHENTICATED");
  });

  it("malformed JSON body", async () => {
    const res = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid request body", code: "INVALID_BODY" });
  });

  it("invalid login format", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-an-email", password: "" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_CREDENTIALS_FORMAT");
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

describe("database pool", () => {
  it("without a listener an idle-connection error would be thrown (this is what would crash the server)", () => {
    expect(() => new Pool().emit("error", new Error("terminating connection"))).toThrow();
  });

  it("our pool logs such an error, without user data, instead of throwing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = Object.assign(new Error("terminating connection due to administrator command"), {
      code: "57P01",
      detail: "Key (email)=(someone@example.test) ...",
    });
    expect(() => pool.emit("error", err)).not.toThrow();
    const logged = JSON.stringify(spy.mock.calls);
    spy.mockRestore();
    expect(logged).toContain("57P01");
    expect(logged).not.toContain("someone@example.test");
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
