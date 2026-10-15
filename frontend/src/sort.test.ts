import { describe, expect, it } from "vitest";
import { nextSort, sortByName, sortCategoryRows, sortMonthRows, sortTransactions, type SortState, type TxSortKey } from "./sort";
import type { Transaction } from "./transactions";

const tx = (id: string, o: Partial<Transaction>): Transaction => ({
  id,
  categoryId: "1",
  type: "expense",
  amountCents: 1000,
  date: "2026-10-05",
  description: "x",
  ...o,
});
const names: Record<string, string> = { "1": "Food", "2": "salary", "3": "Bills" };
const catName = (id: string) => names[id] ?? "Unknown";
const ids = (l: Transaction[]) => l.map((t) => t.id);
const by = (key: TxSortKey, dir: "asc" | "desc"): SortState<TxSortKey> => ({ key, dir });

const rows = [
  tx("a", { date: "2026-10-02", description: "banana", amountCents: 500, categoryId: "1", type: "expense" }),
  tx("b", { date: "2026-10-09", description: "", amountCents: 90000, categoryId: "2", type: "income" }),
  tx("c", { date: "2026-10-02", description: "Apple", amountCents: 500, categoryId: "3", type: "expense" }),
  tx("d", { date: "2026-10-20", description: "cherry", amountCents: 12000, categoryId: "1", type: "expense" }),
];

describe("nextSort", () => {
  it("flips direction on the active column", () => {
    expect(nextSort(by("date", "desc"), "date", "desc")).toEqual(by("date", "asc"));
    expect(nextSort(by("date", "asc"), "date", "desc")).toEqual(by("date", "desc"));
  });
  it("selects a new column with its first direction", () => {
    expect(nextSort(by("date", "asc"), "amount", "desc")).toEqual(by("amount", "desc"));
    expect(nextSort(by("amount", "desc"), "category", "asc")).toEqual(by("category", "asc"));
  });
});

describe("sortTransactions", () => {
  it("sorts by date both ways, keeping the original order for ties (stable)", () => {
    expect(ids(sortTransactions(rows, by("date", "asc"), catName))).toEqual(["a", "c", "b", "d"]);
    expect(ids(sortTransactions(rows, by("date", "desc"), catName))).toEqual(["d", "b", "a", "c"]);
  });
  it("sorts descriptions ignoring case, with empty ones last in BOTH directions", () => {
    expect(ids(sortTransactions(rows, by("description", "asc"), catName))).toEqual(["c", "a", "d", "b"]);
    expect(ids(sortTransactions(rows, by("description", "desc"), catName))).toEqual(["d", "a", "c", "b"]);
  });
  it("sorts categories by name, ignoring case", () => {
    expect(ids(sortTransactions(rows, by("category", "asc"), catName))).toEqual(["c", "a", "d", "b"]);
    expect(ids(sortTransactions(rows, by("category", "desc"), catName))).toEqual(["b", "a", "d", "c"]);
  });
  it("sorts by type", () => {
    expect(ids(sortTransactions(rows, by("type", "asc"), catName))).toEqual(["a", "c", "d", "b"]);
    expect(ids(sortTransactions(rows, by("type", "desc"), catName))).toEqual(["b", "a", "c", "d"]);
  });
  it("sorts by amount numerically (not as text)", () => {
    expect(ids(sortTransactions(rows, by("amount", "asc"), catName))).toEqual(["a", "c", "d", "b"]);
    expect(ids(sortTransactions(rows, by("amount", "desc"), catName))).toEqual(["b", "d", "a", "c"]);
  });
  it("returns a new array and leaves the input untouched", () => {
    const copy = [...rows];
    const out = sortTransactions(rows, by("amount", "desc"), catName);
    expect(rows).toEqual(copy);
    expect(out).not.toBe(rows);
  });
});

describe("sortByName", () => {
  const list = [{ n: "rent" }, { n: "Food" }, { n: "bills" }, { n: "Food" }];
  const names = (l: typeof list) => l.map((x) => x.n);
  it("sorts A to Z ignoring case", () => {
    expect(names(sortByName(list, (x) => x.n, "asc"))).toEqual(["bills", "Food", "Food", "rent"]);
  });
  it("sorts Z to A ignoring case", () => {
    expect(names(sortByName(list, (x) => x.n, "desc"))).toEqual(["rent", "Food", "Food", "bills"]);
  });
  it("does not modify the input", () => {
    const copy = [...list];
    sortByName(list, (x) => x.n, "desc");
    expect(list).toEqual(copy);
  });
});

describe("sortCategoryRows", () => {
  const cats = [
    { categoryName: "rent", spentCents: 100000 },
    { categoryName: "Food", spentCents: 25000 },
    { categoryName: "Fun", spentCents: 25000 },
  ];
  const names = (l: typeof cats) => l.map((c) => c.categoryName);
  it("sorts by name ignoring case", () => {
    expect(names(sortCategoryRows(cats, { key: "category", dir: "asc" }))).toEqual(["Food", "Fun", "rent"]);
    expect(names(sortCategoryRows(cats, { key: "category", dir: "desc" }))).toEqual(["rent", "Fun", "Food"]);
  });
  it("sorts by spent, ties keep original order", () => {
    expect(names(sortCategoryRows(cats, { key: "spent", dir: "desc" }))).toEqual(["rent", "Food", "Fun"]);
    expect(names(sortCategoryRows(cats, { key: "spent", dir: "asc" }))).toEqual(["Food", "Fun", "rent"]);
  });
  it("share gives the same order as spent", () => {
    expect(names(sortCategoryRows(cats, { key: "share", dir: "desc" }))).toEqual(
      names(sortCategoryRows(cats, { key: "spent", dir: "desc" })),
    );
  });
});

describe("sortMonthRows", () => {
  const months = [
    { month: "2026-09", incomeCents: 0, expensesCents: 5000, netCashFlowCents: -5000 },
    { month: "2026-10", incomeCents: 200000, expensesCents: 80000, netCashFlowCents: 120000 },
    { month: "2025-12", incomeCents: 200000, expensesCents: 250000, netCashFlowCents: -50000 },
    { month: "2026-01", incomeCents: 0, expensesCents: 0, netCashFlowCents: 0 },
  ];
  const order = (l: typeof months) => l.map((m) => m.month);

  it("sorts months chronologically across a year boundary", () => {
    expect(order(sortMonthRows(months, { key: "month", dir: "asc" }))).toEqual(["2025-12", "2026-01", "2026-09", "2026-10"]);
    expect(order(sortMonthRows(months, { key: "month", dir: "desc" }))).toEqual(["2026-10", "2026-09", "2026-01", "2025-12"]);
  });
  it("sorts by income, ties keep original order", () => {
    expect(order(sortMonthRows(months, { key: "income", dir: "desc" }))).toEqual(["2026-10", "2025-12", "2026-09", "2026-01"]);
    expect(order(sortMonthRows(months, { key: "income", dir: "asc" }))).toEqual(["2026-09", "2026-01", "2026-10", "2025-12"]);
  });
  it("sorts by expenses", () => {
    expect(order(sortMonthRows(months, { key: "expenses", dir: "desc" }))).toEqual(["2025-12", "2026-10", "2026-09", "2026-01"]);
  });
  it("sorts net cash flow as a signed number (deficit below zero below surplus)", () => {
    expect(order(sortMonthRows(months, { key: "net", dir: "asc" }))).toEqual(["2025-12", "2026-09", "2026-01", "2026-10"]);
    expect(order(sortMonthRows(months, { key: "net", dir: "desc" }))).toEqual(["2026-10", "2026-01", "2026-09", "2025-12"]);
  });
  it("does not modify the input", () => {
    const copy = [...months];
    sortMonthRows(months, { key: "net", dir: "asc" });
    expect(months).toEqual(copy);
  });
});
