import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/db.js";
import { monthBounds } from "../src/months.js";
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

const dashboard = async (a: Agent, month: string) => (await a.get(`/api/dashboard?month=${month}`)).body.dashboard;

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE email = ANY($1)`, [createdEmails]);
  await pool.end();
});

describe("access and validation", () => {
  it("requires a session", async () => {
    expect((await request(app).get("/api/dashboard?month=2026-10")).status).toBe(401);
  });

  it.each(["", "2026-13", "2026-1", "0000-01", "2026-10-01"])("rejects month %j", async (month) => {
    const { agent } = await newUser();
    expect((await agent.get(`/api/dashboard?month=${month}`)).status).toBe(400);
  });

  it("rejects a missing month", async () => {
    const { agent } = await newUser();
    expect((await agent.get("/api/dashboard")).status).toBe(400);
  });
});

describe("empty month", () => {
  it("returns zeros, not nulls or an error", async () => {
    const { agent } = await newUser();
    expect(await dashboard(agent, "2026-10")).toEqual({
      month: "2026-10",
      incomeCents: 0,
      expensesCents: 0,
      netCashFlowCents: 0,
      budgets: { budgetCount: 0, totalBudgetedCents: 0, spentInBudgetedCategoriesCents: 0, overBudgetCount: 0 },
    });
  });
});

describe("totals and budget summary", () => {
  // October 2026: Food expenses $500.00, Transport expenses $100.00 (NO budget), Salary income $2,000.00.
  // Budgets: Food $400 (over by $100), Rent $700 (nothing spent).
  async function scenario() {
    const u = await newUser();
    const food = await category(u.agent, "Food");
    const transport = await category(u.agent, "Transport");
    const salary = await category(u.agent, "Salary");
    const rent = await category(u.agent, "Rent");

    await tx(u.agent, food, "expense", 30000, "2026-10-05");
    await tx(u.agent, food, "expense", 20000, "2026-10-31"); // last day: counts in October
    await tx(u.agent, transport, "expense", 10000, "2026-10-12");
    await tx(u.agent, salary, "income", 200000, "2026-10-01"); // first day: counts in October
    // Traps: neighboring days must not leak into October.
    await tx(u.agent, food, "expense", 99999, "2026-09-30");
    await tx(u.agent, salary, "income", 88888, "2026-11-01");

    await u.agent.put("/api/budgets").send({ categoryId: food, month: "2026-10", limitCents: 40000 });
    await u.agent.put("/api/budgets").send({ categoryId: rent, month: "2026-10", limitCents: 70000 });
    return { ...u, food, transport, salary, rent };
  }

  it("computes income, expenses and net cash flow for the month only", async () => {
    const { agent } = await scenario();
    const d = await dashboard(agent, "2026-10");
    expect(d.incomeCents).toBe(200000);
    expect(d.expensesCents).toBe(60000);
    expect(d.netCashFlowCents).toBe(140000);
  });

  it("budget summary: spending counts only budgeted categories, and over-budget is counted", async () => {
    const { agent } = await scenario();
    const d = await dashboard(agent, "2026-10");
    expect(d.budgets).toEqual({
      budgetCount: 2,
      totalBudgetedCents: 110000,
      spentInBudgetedCategoriesCents: 50000, // Food only; Transport has no budget
      overBudgetCount: 1, // Food: 50000 spent of 40000
    });
    // Different questions, both right: total expenses ($600) > spending in budgeted categories ($500).
    expect(d.expensesCents).toBeGreaterThan(d.budgets.spentInBudgetedCategoriesCents);
    expect(d.expensesCents - d.budgets.spentInBudgetedCategoriesCents).toBe(10000); // exactly Transport
  });

  it("RECONCILES: total expenses equals the sum of per-category spending, unbudgeted categories included", async () => {
    const { agent, id } = await scenario();
    const { from, to } = monthBounds("2026-10");
    const perCategory = await spentByCategory(id, from, to); // independent query from the dashboard's
    const sumOfCategories = [...perCategory.values()].reduce((a, b) => a + b, 0);
    expect(perCategory.size).toBe(2); // Food and Transport
    expect((await dashboard(agent, "2026-10")).expensesCents).toBe(sumOfCategories);
  });

  it("neighboring months get their own totals (boundaries do not double count)", async () => {
    const { agent } = await scenario();
    const sep = await dashboard(agent, "2026-09");
    const nov = await dashboard(agent, "2026-11");
    expect(sep).toMatchObject({ incomeCents: 0, expensesCents: 99999, netCashFlowCents: -99999 });
    expect(nov).toMatchObject({ incomeCents: 88888, expensesCents: 0, netCashFlowCents: 88888 });
  });

  it("net cash flow can be negative (spending more than earned)", async () => {
    const { agent } = await newUser();
    const c = await category(agent, "Fun");
    await tx(agent, c, "expense", 12345, "2026-10-10");
    await tx(agent, c, "income", 1000, "2026-10-11");
    expect(await dashboard(agent, "2026-10")).toMatchObject({ netCashFlowCents: -11345 });
  });

  it("reflects edits and deletes immediately (always computed live)", async () => {
    const { agent } = await newUser();
    const c = await category(agent, "Misc");
    const id = (await tx(agent, c, "expense", 5000, "2026-10-10")).body.transaction.id;
    expect((await dashboard(agent, "2026-10")).expensesCents).toBe(5000);

    await agent.patch(`/api/transactions/${id}`).send({ amountCents: 7500 });
    expect((await dashboard(agent, "2026-10")).expensesCents).toBe(7500);

    await agent.patch(`/api/transactions/${id}`).send({ type: "income" }); // flips from expense to income
    expect(await dashboard(agent, "2026-10")).toMatchObject({ incomeCents: 7500, expensesCents: 0, netCashFlowCents: 7500 });

    await agent.delete(`/api/transactions/${id}`);
    expect(await dashboard(agent, "2026-10")).toMatchObject({ incomeCents: 0, expensesCents: 0 });
  });
});

describe("user isolation", () => {
  it("B's data never appears in A's dashboard, and B sees nothing of A's", async () => {
    const a = await newUser();
    const b = await newUser();
    const catA = await category(a.agent, "Food");
    await tx(a.agent, catA, "expense", 32000, "2026-10-10");
    await tx(a.agent, catA, "income", 5000, "2026-10-11");
    await a.agent.put("/api/budgets").send({ categoryId: catA, month: "2026-10", limitCents: 50000 });

    const catB = await category(b.agent, "Food"); // same name, different user
    await tx(b.agent, catB, "expense", 999999, "2026-10-10");
    await tx(b.agent, catB, "income", 777777, "2026-10-10");

    expect(await dashboard(a.agent, "2026-10")).toMatchObject({
      incomeCents: 5000,
      expensesCents: 32000,
      budgets: { budgetCount: 1, spentInBudgetedCategoriesCents: 32000, overBudgetCount: 0 },
    });
    expect(await dashboard(b.agent, "2026-10")).toMatchObject({
      incomeCents: 777777,
      expensesCents: 999999,
      budgets: { budgetCount: 0, totalBudgetedCents: 0 },
    });
  });
});
