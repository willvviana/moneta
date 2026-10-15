import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/db.js";
import { monthBounds } from "../src/months.js";

type Agent = ReturnType<typeof request.agent>;
const createdEmails: string[] = [];

// Random email and runtime-generated password: no credential literal in test code.
async function newUser(): Promise<Agent> {
  const agent = request.agent(app);
  const email = `t-${randomUUID()}@example.test`;
  const password = randomBytes(18).toString("base64url");
  expect((await agent.post("/api/auth/register").send({ email, password })).status).toBe(201);
  createdEmails.push(email);
  return agent;
}

const category = async (a: Agent, name: string): Promise<string> =>
  (await a.post("/api/categories").send({ name })).body.category.id;

const tx = (a: Agent, categoryId: string, type: "income" | "expense", amountCents: number, date: string) =>
  a.post("/api/transactions").send({ categoryId, type, amountCents, date, description: "" });

const putBudget = (a: Agent, categoryId: string, month: string, limitCents: number) =>
  a.put("/api/budgets").send({ categoryId, month, limitCents });

const listBudgets = (a: Agent, month: string) => a.get(`/api/budgets?month=${month}`);

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE email = ANY($1)`, [createdEmails]);
  await pool.end();
});

describe("monthBounds (half-open month range)", () => {
  it.each([
    ["2026-10", "2026-10-01", "2026-11-01"],
    ["2026-12", "2026-12-01", "2027-01-01"], // December rolls into the next year
    ["2026-02", "2026-02-01", "2026-03-01"],
    ["2099-12", "2099-12-01", "2100-01-01"],
  ])("%s -> [%s, %s)", (ym, from, to) => {
    expect(monthBounds(ym)).toEqual({ from, to });
  });
});

describe("authentication", () => {
  it("GET /api/budgets without a session is 401", async () => {
    expect((await request(app).get("/api/budgets?month=2026-10")).status).toBe(401);
  });
});

describe("budget spending calculation", () => {
  let u: Agent;
  let food: string;
  let rent: string;

  beforeAll(async () => {
    u = await newUser();
    food = await category(u, "Food");
    rent = await category(u, "Rent");

    // October 2026, Food: expenses 100.00 + 220.00 = 320.00. Boundaries and income are traps.
    await tx(u, food, "expense", 10000, "2026-10-05");
    await tx(u, food, "expense", 22000, "2026-10-31"); // last day: counts in October
    await tx(u, food, "income", 99999, "2026-10-10"); // income: must NOT count
    await tx(u, food, "expense", 5000, "2026-11-01"); // first day of November: NOT October
    await tx(u, food, "expense", 7777, "2026-09-30"); // last day of September: NOT October
  });

  it("$500 budget with $320 spent leaves $180 (income, other months and boundaries ignored)", async () => {
    const put = await putBudget(u, food, "2026-10", 50000);
    expect(put.status).toBe(200);
    expect(put.body.budget).toMatchObject({ categoryId: food, month: "2026-10", limitCents: 50000, spentCents: 32000, remainingCents: 18000 });

    const list = await listBudgets(u, "2026-10");
    expect(list.body.budgets).toHaveLength(1);
    expect(list.body.budgets[0]).toMatchObject({ spentCents: 32000, remainingCents: 18000 });
  });

  it("a budget with no spending shows spent 0 and the full limit remaining", async () => {
    const res = await putBudget(u, rent, "2026-10", 70000);
    expect(res.body.budget).toMatchObject({ spentCents: 0, remainingCents: 70000 });
  });

  it("over budget gives a NEGATIVE remaining amount (November: $50.00 spent against a $10.00 limit)", async () => {
    const res = await putBudget(u, food, "2026-11", 1000);
    expect(res.body.budget).toMatchObject({ spentCents: 5000, remainingCents: -4000 });
  });

  it("setting the same category and month again replaces the limit (still one budget)", async () => {
    await putBudget(u, food, "2026-10", 60000);
    const list = await listBudgets(u, "2026-10");
    const foodBudgets = list.body.budgets.filter((b: { categoryId: string }) => b.categoryId === food);
    expect(foodBudgets).toHaveLength(1);
    expect(foodBudgets[0]).toMatchObject({ limitCents: 60000, remainingCents: 28000 });
  });

  it("spending in a category without a budget is not listed; an empty month lists nothing", async () => {
    expect((await listBudgets(u, "2026-09")).body.budgets).toEqual([]); // Food has $77.77 spent in September, no budget
  });

  it("budgets live in their own month", async () => {
    const oct = (await listBudgets(u, "2026-10")).body.budgets.map((b: { month: string }) => b.month);
    expect(new Set(oct)).toEqual(new Set(["2026-10"]));
  });

  it("editing or deleting a transaction changes the budget numbers (always computed live)", async () => {
    const created = await tx(u, rent, "expense", 25000, "2026-10-15");
    const id = created.body.transaction.id;
    let rentBudget = (await listBudgets(u, "2026-10")).body.budgets.find((b: { categoryId: string }) => b.categoryId === rent);
    expect(rentBudget).toMatchObject({ spentCents: 25000, remainingCents: 45000 });

    await u.delete(`/api/transactions/${id}`);
    rentBudget = (await listBudgets(u, "2026-10")).body.budgets.find((b: { categoryId: string }) => b.categoryId === rent);
    expect(rentBudget).toMatchObject({ spentCents: 0, remainingCents: 70000 });
  });
});

describe("user isolation (A owns the budget, B attacks it)", () => {
  let a: Agent;
  let b: Agent;
  let catA: string;
  let budgetA: string;

  beforeAll(async () => {
    a = await newUser();
    b = await newUser();
    catA = await category(a, "Food");
    await tx(a, catA, "expense", 32000, "2026-10-10");
    budgetA = (await putBudget(a, catA, "2026-10", 50000)).body.budget.id;
  });

  const aBudgetUnchanged = async () => {
    const list = await listBudgets(a, "2026-10");
    expect(list.body.budgets).toHaveLength(1);
    expect(list.body.budgets[0]).toMatchObject({ id: budgetA, limitCents: 50000, spentCents: 32000 });
  };

  it("B cannot list A's budgets", async () => {
    expect((await listBudgets(b, "2026-10")).body.budgets).toEqual([]);
  });

  it("B cannot delete A's budget (404) and it still exists", async () => {
    expect((await b.delete(`/api/budgets/${budgetA}`)).status).toBe(404);
    await aBudgetUnchanged();
  });

  it("B cannot set a budget on A's category (400) and cannot overwrite A's limit", async () => {
    expect((await putBudget(b, catA, "2026-10", 1)).status).toBe(400);
    await aBudgetUnchanged();
  });

  it("B's spending never counts toward A's budget, even in a category with the same name", async () => {
    const catB = await category(b, "Food");
    await tx(b, catB, "expense", 99999, "2026-10-10");
    await aBudgetUnchanged(); // A still sees spent 32000
    const bBudget = await putBudget(b, catB, "2026-10", 100000);
    expect(bBudget.body.budget).toMatchObject({ spentCents: 99999, remainingCents: 1 });
  });

  it("a client cannot send userId (400)", async () => {
    expect((await a.put("/api/budgets").send({ categoryId: catA, month: "2026-10", limitCents: 1, userId: "999" })).status).toBe(400);
  });
});

describe("validation", () => {
  let u: Agent;
  let cat: string;

  beforeAll(async () => {
    u = await newUser();
    cat = await category(u, "General");
  });

  it.each([
    ["zero", 0],
    ["negative", -100],
    ["fractional", 10.5],
    ["a string", "5000"],
    ["an unsafe integer", Number.MAX_SAFE_INTEGER + 2],
  ])("rejects limitCents that is %s", async (_l, limitCents) => {
    expect((await u.put("/api/budgets").send({ categoryId: cat, month: "2026-10", limitCents })).status).toBe(400);
  });

  it.each(["2026-13", "2026-00", "2026-1", "26-10", "2026-10-01", "0000-01", "2100-01", ""])(
    "rejects month %j on PUT",
    async (month) => {
      expect((await u.put("/api/budgets").send({ categoryId: cat, month, limitCents: 1000 })).status).toBe(400);
    },
  );

  it("rejects a missing or malformed month on GET", async () => {
    expect((await u.get("/api/budgets")).status).toBe(400);
    expect((await u.get("/api/budgets?month=2026-13")).status).toBe(400);
  });

  it("rejects a non-numeric or oversized budget id as 404", async () => {
    expect((await u.delete("/api/budgets/abc")).status).toBe(404);
  });
});

describe("category deletion is blocked while a budget uses it", () => {
  it("409 with a budget; 204 once the budget is removed", async () => {
    const u = await newUser();
    const cat = await category(u, "Hobby");
    const budgetId = (await putBudget(u, cat, "2026-10", 5000)).body.budget.id;

    expect((await u.delete(`/api/categories/${cat}`)).status).toBe(409);
    expect((await u.delete(`/api/budgets/${budgetId}`)).status).toBe(204);
    expect((await u.delete(`/api/categories/${cat}`)).status).toBe(204);
  });
});
