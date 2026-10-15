import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/db.js";
import { monthCount, rangeBounds } from "../src/months.js";
import { spentByCategory } from "../src/repositories/spending.js";

type Agent = ReturnType<typeof request.agent>;
const createdEmails: string[] = [];

// Random email and runtime-generated password: no credential literal in test code.
async function newUser(): Promise<{ agent: Agent; id: string }> {
  const agent = request.agent(app);
  const email = `t-${randomUUID()}@example.test`;
  const password = randomBytes(18).toString("base64url");
  const res = await agent.post("/api/auth/register").send({ email, password });
  expect(res.status).toBe(201);
  createdEmails.push(email);
  return { agent, id: res.body.user.id };
}

const category = async (a: Agent, name: string): Promise<string> =>
  (await a.post("/api/categories").send({ name })).body.category.id;

const tx = (a: Agent, categoryId: string, type: "income" | "expense", amountCents: number, date: string) =>
  a.post("/api/transactions").send({ categoryId, type, amountCents, date, description: "" });

const byCategory = async (a: Agent, from: string, to: string) =>
  (await a.get(`/api/reports/spending-by-category?from=${from}&to=${to}`)).body.report;
const overTime = async (a: Agent, from: string, to: string) =>
  (await a.get(`/api/reports/over-time?from=${from}&to=${to}`)).body.report;
const dashboard = async (a: Agent, month: string) => (await a.get(`/api/dashboard?month=${month}`)).body.dashboard;

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE email = ANY($1)`, [createdEmails]);
  await pool.end();
});

describe("month range helpers", () => {
  it.each([
    ["2026-01", "2026-03", 3],
    ["2026-05", "2026-05", 1], // same month = 1
    ["2025-12", "2026-01", 2], // across a year boundary
    ["2021-01", "2025-12", 60],
    ["2021-01", "2026-01", 61],
  ])("monthCount(%s, %s) = %d", (from, to, n) => expect(monthCount(from, to)).toBe(n));

  it.each([
    ["2026-01", "2026-03", "2026-01-01", "2026-04-01"], // the example from the design: up to, EXCLUDING, April 1
    ["2026-05", "2026-05", "2026-05-01", "2026-06-01"],
    ["2025-11", "2025-12", "2025-11-01", "2026-01-01"], // December rolls into the next year
  ])("rangeBounds(%s, %s) = [%s, %s)", (from, to, f, t) => expect(rangeBounds(from, to)).toEqual({ from: f, to: t }));
});

describe("access and validation (both endpoints)", () => {
  const endpoints = ["spending-by-category", "over-time"];

  it.each(endpoints)("%s requires a session", async (e) => {
    expect((await request(app).get(`/api/reports/${e}?from=2026-01&to=2026-03`)).status).toBe(401);
  });

  it.each(endpoints)("%s accepts a 60-month range and a one-month range", async (e) => {
    const { agent } = await newUser();
    expect((await agent.get(`/api/reports/${e}?from=2021-01&to=2025-12`)).status).toBe(200);
    expect((await agent.get(`/api/reports/${e}?from=2026-05&to=2026-05`)).status).toBe(200);
  });

  it.each(endpoints)("%s rejects invalid ranges with 400", async (e) => {
    const { agent } = await newUser();
    const bad = [
      "", // both missing
      "?from=2026-01", // to missing
      "?to=2026-03", // from missing
      "?from=2026-13&to=2026-14", // not months
      "?from=2026-1&to=2026-3", // wrong format
      "?from=2026-01-01&to=2026-03-01", // dates, not months
      "?from=0000-01&to=0000-02", // unsupported year
      "?from=2026-03&to=2026-01", // from after to
      "?from=2021-01&to=2026-01", // 61 months
    ];
    for (const q of bad) expect((await agent.get(`/api/reports/${e}${q}`)).status, q).toBe(400);
  });
});

describe("empty range", () => {
  it("returns zeros and zero-filled months, never nulls", async () => {
    const { agent } = await newUser();
    expect(await byCategory(agent, "2026-01", "2026-03")).toEqual({
      from: "2026-01",
      to: "2026-03",
      totalSpentCents: 0,
      categories: [],
    });
    const t = await overTime(agent, "2026-01", "2026-03");
    expect(t.months).toHaveLength(3);
    expect(t.months.every((m: { incomeCents: number; expensesCents: number }) => m.incomeCents === 0 && m.expensesCents === 0)).toBe(true);
    expect(t.totals).toEqual({ incomeCents: 0, expensesCents: 0, netCashFlowCents: 0 });
  });
});

describe("report values (Jan-Mar 2026, with boundary traps)", () => {
  // Jan: Food expense 10000 (first day), Salary income 200000
  // Feb: nothing at all (must still appear as a zero month)
  // Mar: Food expense 5000 (last day), Transport expense 2500 (NO budget anywhere), Salary income 200000
  // Traps outside the range: Dec 31 2025 and Apr 1 2026.
  async function scenario() {
    const u = await newUser();
    const food = await category(u.agent, "Food");
    const transport = await category(u.agent, "Transport");
    const salary = await category(u.agent, "Salary");

    await tx(u.agent, food, "expense", 10000, "2026-01-01");
    await tx(u.agent, salary, "income", 200000, "2026-01-15");
    await tx(u.agent, salary, "income", 200000, "2026-03-01");
    await tx(u.agent, food, "expense", 5000, "2026-03-31");
    await tx(u.agent, transport, "expense", 2500, "2026-03-10");
    await tx(u.agent, food, "expense", 99999, "2025-12-31");
    await tx(u.agent, food, "expense", 88888, "2026-04-01");
    await tx(u.agent, salary, "income", 77777, "2026-04-01");

    await u.agent.put("/api/budgets").send({ categoryId: food, month: "2026-01", limitCents: 50000 }); // only Food has a budget
    return { ...u, food, transport, salary };
  }

  it("spending by category: largest first, unbudgeted categories included, income excluded", async () => {
    const { agent, food, transport } = await scenario();
    const r = await byCategory(agent, "2026-01", "2026-03");
    expect(r.categories).toEqual([
      { categoryId: food, categoryName: "Food", spentCents: 15000 }, // 10000 + 5000; traps excluded
      { categoryId: transport, categoryName: "Transport", spentCents: 2500 }, // no budget, still reported
    ]);
    expect(r.totalSpentCents).toBe(17500);
  });

  it("breaks ties by name so the order is stable", async () => {
    const { agent } = await newUser();
    const b = await category(agent, "Bravo");
    const a = await category(agent, "Alpha");
    await tx(agent, b, "expense", 1000, "2026-05-10");
    await tx(agent, a, "expense", 1000, "2026-05-11");
    const r = await byCategory(agent, "2026-05", "2026-05");
    expect(r.categories.map((c: { categoryName: string }) => c.categoryName)).toEqual(["Alpha", "Bravo"]);
  });

  it("over time: one bucket per month, the empty month is a zero row, boundaries are exact", async () => {
    const { agent } = await scenario();
    const r = await overTime(agent, "2026-01", "2026-03");
    expect(r.months).toEqual([
      { month: "2026-01", incomeCents: 200000, expensesCents: 10000, netCashFlowCents: 190000 },
      { month: "2026-02", incomeCents: 0, expensesCents: 0, netCashFlowCents: 0 },
      { month: "2026-03", incomeCents: 200000, expensesCents: 7500, netCashFlowCents: 192500 },
    ]);
    expect(r.totals).toEqual({ incomeCents: 400000, expensesCents: 17500, netCashFlowCents: 382500 });
  });

  it("net cash flow can be negative in a month", async () => {
    const { agent } = await newUser();
    const c = await category(agent, "Fun");
    await tx(agent, c, "expense", 9000, "2026-06-10");
    await tx(agent, c, "income", 1000, "2026-06-11");
    const r = await overTime(agent, "2026-06", "2026-06");
    expect(r.months[0].netCashFlowCents).toBe(-8000);
  });

  it("a range crossing a year boundary has the right months in order", async () => {
    const { agent } = await newUser();
    const r = await overTime(agent, "2025-11", "2026-02");
    expect(r.months.map((m: { month: string }) => m.month)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("reports change immediately after an edit or delete (always computed live)", async () => {
    const { agent } = await newUser();
    const c = await category(agent, "Misc");
    const id = (await tx(agent, c, "expense", 5000, "2026-07-10")).body.transaction.id;
    expect((await byCategory(agent, "2026-07", "2026-07")).totalSpentCents).toBe(5000);
    await agent.patch(`/api/transactions/${id}`).send({ date: "2026-08-01" }); // moves to the next month
    expect((await byCategory(agent, "2026-07", "2026-07")).totalSpentCents).toBe(0);
    expect((await byCategory(agent, "2026-08", "2026-08")).totalSpentCents).toBe(5000);
    await agent.delete(`/api/transactions/${id}`);
    expect((await byCategory(agent, "2026-08", "2026-08")).totalSpentCents).toBe(0);
  });
});

describe("RECONCILIATION (consistent calculations)", () => {
  it("category total = sum of category rows = sum of monthly expense buckets = independent query, all expense categories included", async () => {
    const u = await newUser();
    const food = await category(u.agent, "Food");
    const transport = await category(u.agent, "Transport");
    const rent = await category(u.agent, "Rent"); // never gets an expense
    await tx(u.agent, food, "expense", 10000, "2026-01-01");
    await tx(u.agent, food, "expense", 5000, "2026-03-31");
    await tx(u.agent, transport, "expense", 2500, "2026-02-14");
    await tx(u.agent, transport, "income", 4242, "2026-02-15"); // income must not leak into spending
    await u.agent.put("/api/budgets").send({ categoryId: food, month: "2026-01", limitCents: 1 }); // Transport has none
    void rent;

    const cat = await byCategory(u.agent, "2026-01", "2026-03");
    const time = await overTime(u.agent, "2026-01", "2026-03");

    const sumOfRows = cat.categories.reduce((s: number, c: { spentCents: number }) => s + c.spentCents, 0);
    const sumOfMonths = time.months.reduce((s: number, m: { expensesCents: number }) => s + m.expensesCents, 0);
    const bounds = rangeBounds("2026-01", "2026-03");
    const independent = [...(await spentByCategory(u.id, bounds.from, bounds.to)).values()].reduce((a, b) => a + b, 0);

    expect(cat.totalSpentCents).toBe(17500);
    expect(sumOfRows).toBe(cat.totalSpentCents);
    expect(sumOfMonths).toBe(cat.totalSpentCents);
    expect(time.totals.expensesCents).toBe(cat.totalSpentCents);
    expect(independent).toBe(cat.totalSpentCents);
  });

  it("a one-month report equals that month's Dashboard (income, expenses, net, total spending)", async () => {
    const u = await newUser();
    const food = await category(u.agent, "Food");
    const salary = await category(u.agent, "Salary");
    await tx(u.agent, salary, "income", 200000, "2026-10-01"); // first day
    await tx(u.agent, food, "expense", 30000, "2026-10-05");
    await tx(u.agent, food, "expense", 20000, "2026-10-31"); // last day
    await tx(u.agent, food, "expense", 99999, "2026-09-30"); // traps
    await tx(u.agent, salary, "income", 88888, "2026-11-01");

    for (const month of ["2026-09", "2026-10", "2026-11", "2026-12"]) {
      const d = await dashboard(u.agent, month);
      const t = (await overTime(u.agent, month, month)).months[0];
      const c = await byCategory(u.agent, month, month);
      expect(t.incomeCents, `${month} income`).toBe(d.incomeCents);
      expect(t.expensesCents, `${month} expenses`).toBe(d.expensesCents);
      expect(t.netCashFlowCents, `${month} net`).toBe(d.netCashFlowCents);
      expect(c.totalSpentCents, `${month} category total`).toBe(d.expensesCents);
    }
  });
});

describe("user isolation", () => {
  it("B's data never appears in A's reports, and B sees none of A's", async () => {
    const a = await newUser();
    const b = await newUser();
    const catA = await category(a.agent, "Food");
    await tx(a.agent, catA, "expense", 32000, "2026-10-10");
    await tx(a.agent, catA, "income", 5000, "2026-10-11");

    const catB = await category(b.agent, "Food"); // same name, other user
    await tx(b.agent, catB, "expense", 999999, "2026-10-10");
    await tx(b.agent, catB, "income", 777777, "2026-10-12");

    const aCat = await byCategory(a.agent, "2026-10", "2026-10");
    expect(aCat.totalSpentCents).toBe(32000);
    expect(aCat.categories).toHaveLength(1);
    expect((await overTime(a.agent, "2026-10", "2026-10")).totals).toMatchObject({ incomeCents: 5000, expensesCents: 32000 });

    expect((await byCategory(b.agent, "2026-10", "2026-10")).totalSpentCents).toBe(999999);
    expect((await overTime(b.agent, "2026-10", "2026-10")).totals).toMatchObject({ incomeCents: 777777, expensesCents: 999999 });
  });
});
