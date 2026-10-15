import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/db.js";

type Agent = ReturnType<typeof request.agent>;
const createdEmails: string[] = [];

// Each test user gets a random email and a random password generated at runtime:
// no credential literal exists anywhere in the test code.
async function newUser(): Promise<Agent> {
  const agent = request.agent(app); // an agent keeps cookies, like a browser
  const email = `t-${randomUUID()}@example.test`;
  const password = randomBytes(18).toString("base64url");
  const res = await agent.post("/api/auth/register").send({ email, password });
  expect(res.status).toBe(201);
  createdEmails.push(email);
  return agent;
}

const RANGE = "from=2026-10-01&to=2026-11-01";
const validTx = (categoryId: string) => ({
  categoryId,
  type: "expense",
  amountCents: 1234,
  date: "2026-10-15",
  description: "lunch",
});

afterAll(async () => {
  // ON DELETE CASCADE removes the users' sessions, categories and transactions.
  await pool.query(`DELETE FROM users WHERE email = ANY($1)`, [createdEmails]);
  await pool.end();
});

describe("authentication is required", () => {
  it.each(["/api/categories", `/api/transactions?${RANGE}`])("GET %s without a session is 401", async (url) => {
    expect((await request(app).get(url)).status).toBe(401);
  });
});

describe("user isolation (A owns the data, B attacks it)", () => {
  let a: Agent;
  let b: Agent;
  let catA: string;
  let txA: string;

  beforeAll(async () => {
    a = await newUser();
    b = await newUser();
    catA = (await a.post("/api/categories").send({ name: "Food" })).body.category.id;
    txA = (await a.post("/api/transactions").send(validTx(catA))).body.transaction.id;
  });

  const aStillHasUnchangedTx = async () => {
    const res = await a.get(`/api/transactions?${RANGE}`);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0]).toMatchObject({ id: txA, amountCents: 1234, description: "lunch" });
  };

  it("B cannot list A's transactions", async () => {
    const res = await b.get(`/api/transactions?${RANGE}`);
    expect(res.status).toBe(200);
    expect(res.body.transactions).toEqual([]);
  });

  it("B cannot list A's categories", async () => {
    expect((await b.get("/api/categories")).body.categories).toEqual([]);
  });

  it("B cannot update A's transaction (404) and it stays unchanged", async () => {
    const res = await b.patch(`/api/transactions/${txA}`).send({ amountCents: 1 });
    expect(res.status).toBe(404);
    await aStillHasUnchangedTx();
  });

  it("B cannot delete A's transaction (404) and it still exists", async () => {
    expect((await b.delete(`/api/transactions/${txA}`)).status).toBe(404);
    await aStillHasUnchangedTx();
  });

  it("B cannot attach a new transaction to A's category (400)", async () => {
    const res = await b.post("/api/transactions").send(validTx(catA));
    expect(res.status).toBe(400);
  });

  it("B cannot move their own transaction into A's category (400)", async () => {
    const catB = (await b.post("/api/categories").send({ name: "Mine" })).body.category.id;
    const txB = (await b.post("/api/transactions").send(validTx(catB))).body.transaction.id;
    const res = await b.patch(`/api/transactions/${txB}`).send({ categoryId: catA });
    expect(res.status).toBe(400);
  });

  it("B cannot rename or delete A's category (404)", async () => {
    expect((await b.patch(`/api/categories/${catA}`).send({ name: "Hacked" })).status).toBe(404);
    expect((await b.delete(`/api/categories/${catA}`)).status).toBe(404);
  });

  it("a client cannot set userId on create or patch (400)", async () => {
    expect((await b.post("/api/transactions").send({ ...validTx(catA), userId: "1" })).status).toBe(400);
    expect((await a.patch(`/api/transactions/${txA}`).send({ userId: "999" })).status).toBe(400);
    await aStillHasUnchangedTx();
  });
});

describe("transactions CRUD and validation", () => {
  let u: Agent;
  let cat: string;

  beforeAll(async () => {
    u = await newUser();
    cat = (await u.post("/api/categories").send({ name: "General" })).body.category.id;
  });

  it("creates, lists, partially updates and deletes", async () => {
    const created = await u.post("/api/transactions").send(validTx(cat));
    expect(created.status).toBe(201);
    expect(created.body.transaction).toMatchObject({ amountCents: 1234, date: "2026-10-15", type: "expense" });
    const id = created.body.transaction.id;

    const patched = await u.patch(`/api/transactions/${id}`).send({ description: "dinner" });
    expect(patched.status).toBe(200);
    expect(patched.body.transaction).toMatchObject({ description: "dinner", amountCents: 1234 }); // untouched field kept

    expect((await u.delete(`/api/transactions/${id}`)).status).toBe(204);
    expect((await u.delete(`/api/transactions/${id}`)).status).toBe(404);
  });

  it.each([
    ["zero", 0],
    ["negative", -5],
    ["fractional", 12.5],
    ["a string", "1234"],
    ["unsafe integer", Number.MAX_SAFE_INTEGER + 2],
  ])("rejects amountCents that is %s", async (_label, amountCents) => {
    const res = await u.post("/api/transactions").send({ ...validTx(cat), amountCents });
    expect(res.status).toBe(400);
  });

  it("rejects an impossible date and a bad type", async () => {
    expect((await u.post("/api/transactions").send({ ...validTx(cat), date: "2026-02-30" })).status).toBe(400);
    expect((await u.post("/api/transactions").send({ ...validTx(cat), type: "refund" })).status).toBe(400);
  });

  it("rejects dates outside 1900-2099 (PostgreSQL has no year 0; must be 400, not 500)", async () => {
    expect((await u.post("/api/transactions").send({ ...validTx(cat), date: "0000-01-01" })).status).toBe(400);
    expect((await u.post("/api/transactions").send({ ...validTx(cat), date: "2100-01-01" })).status).toBe(400);
    expect((await u.get("/api/transactions?from=0000-01-01&to=0001-01-01")).status).toBe(400);
  });

  it("rejects an empty patch", async () => {
    const id = (await u.post("/api/transactions").send(validTx(cat))).body.transaction.id;
    expect((await u.patch(`/api/transactions/${id}`).send({})).status).toBe(400);
  });

  it("treats a malformed id as 404", async () => {
    expect((await u.delete("/api/transactions/abc")).status).toBe(404);
  });

  it("date range is half-open [from, to)", async () => {
    const r = await newUser();
    const c = (await r.post("/api/categories").send({ name: "Edge" })).body.category.id;
    await r.post("/api/transactions").send({ ...validTx(c), date: "2026-10-31" });
    await r.post("/api/transactions").send({ ...validTx(c), date: "2026-11-01" });
    const res = await r.get(`/api/transactions?${RANGE}`);
    expect(res.body.transactions.map((t: { date: string }) => t.date)).toEqual(["2026-10-31"]); // Nov 1 excluded
  });

  it("rejects missing, invalid or inverted ranges", async () => {
    expect((await u.get("/api/transactions")).status).toBe(400);
    expect((await u.get("/api/transactions?from=2026-13-01&to=2026-14-01")).status).toBe(400);
    expect((await u.get("/api/transactions?from=2026-11-01&to=2026-10-01")).status).toBe(400);
    expect((await u.get("/api/transactions?from=2026-10-01&to=2026-10-01")).status).toBe(400); // empty range
  });
});

describe("categories", () => {
  it("rejects duplicate names (409) and deleting a category in use (409)", async () => {
    const u = await newUser();
    const cat = (await u.post("/api/categories").send({ name: "Rent" })).body.category.id;
    expect((await u.post("/api/categories").send({ name: "Rent" })).status).toBe(409);

    await u.post("/api/transactions").send(validTx(cat));
    expect((await u.delete(`/api/categories/${cat}`)).status).toBe(409);
  });

  it("two users may use the same category name", async () => {
    const [x, y] = [await newUser(), await newUser()];
    expect((await x.post("/api/categories").send({ name: "Same" })).status).toBe(201);
    expect((await y.post("/api/categories").send({ name: "Same" })).status).toBe(201);
  });
});
