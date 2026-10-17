import { describe, expect, it } from "vitest";
import type { Budget } from "./budgets";
import {
  EMPTY_TX_FILTERS,
  amountRangeProblem,
  filterBudgets,
  filterTransactions,
  hasActiveTxFilters,
  matchesName,
  parseAmountFilter,
  type TxFilters,
} from "./filters";
import type { Transaction } from "./transactions";

const tx = (id: string, o: Partial<Transaction>): Transaction => ({
  id,
  categoryId: "1",
  type: "expense",
  amountCents: 1000,
  date: "2026-10-05",
  description: "",
  ...o,
});

const rows: Transaction[] = [
  tx("a", { description: "Lunch at Sushi Place", amountCents: 1250, categoryId: "1" }),
  tx("b", { description: "Monthly SALARY", amountCents: 200000, type: "income", categoryId: "2" }),
  tx("c", { description: "bus pass", amountCents: 5000, categoryId: "3" }),
  tx("d", { description: "", amountCents: 1000, categoryId: "1" }), // no description
];
const ids = (list: Transaction[]) => list.map((t) => t.id);
const withFilters = (o: Partial<TxFilters>): TxFilters => ({ ...EMPTY_TX_FILTERS, ...o });

describe("filterTransactions", () => {
  it("no filters returns everything, in the original order", () => {
    expect(ids(filterTransactions(rows, EMPTY_TX_FILTERS))).toEqual(["a", "b", "c", "d"]);
  });

  it("filters by type", () => {
    expect(ids(filterTransactions(rows, withFilters({ type: "income" })))).toEqual(["b"]);
    expect(ids(filterTransactions(rows, withFilters({ type: "expense" })))).toEqual(["a", "c", "d"]);
  });

  it("filters by category", () => {
    expect(ids(filterTransactions(rows, withFilters({ categoryId: "1" })))).toEqual(["a", "d"]);
    expect(ids(filterTransactions(rows, withFilters({ categoryId: "999" })))).toEqual([]);
  });

  it("searches descriptions ignoring case, matching anywhere, trimming the query", () => {
    expect(ids(filterTransactions(rows, withFilters({ text: "salary" })))).toEqual(["b"]);
    expect(ids(filterTransactions(rows, withFilters({ text: "  SUSHI " })))).toEqual(["a"]);
    expect(ids(filterTransactions(rows, withFilters({ text: "pass" })))).toEqual(["c"]);
    expect(ids(filterTransactions(rows, withFilters({ text: "zzz" })))).toEqual([]);
  });

  it("a search never matches a transaction that has no description", () => {
    expect(ids(filterTransactions(rows, withFilters({ text: "a" })))).not.toContain("d");
  });

  it("amount bounds are INCLUSIVE and parsed to cents (dot or comma)", () => {
    expect(ids(filterTransactions(rows, withFilters({ min: "12.50" })))).toEqual(["a", "b", "c"]); // 1250 is included
    expect(ids(filterTransactions(rows, withFilters({ max: "12,50" })))).toEqual(["a", "d"]); // 1250 is included
    expect(ids(filterTransactions(rows, withFilters({ min: "10", max: "50" })))).toEqual(["a", "c", "d"]);
    expect(ids(filterTransactions(rows, withFilters({ min: "50", max: "50" })))).toEqual(["c"]); // min = max: exact amount
  });

  it("combines every filter with AND", () => {
    const f = withFilters({ type: "expense", categoryId: "1", text: "lunch", min: "10", max: "20" });
    expect(ids(filterTransactions(rows, f))).toEqual(["a"]);
  });

  it("ignores an invalid or inverted amount filter instead of emptying the table", () => {
    expect(ids(filterTransactions(rows, withFilters({ min: "abc" })))).toEqual(["a", "b", "c", "d"]);
    expect(ids(filterTransactions(rows, withFilters({ min: "100", max: "10" })))).toEqual(["a", "b", "c", "d"]);
  });

  it("does not modify the list it was given", () => {
    const copy = [...rows];
    filterTransactions(rows, withFilters({ type: "income" }));
    expect(rows).toEqual(copy);
  });
});

describe("amount filter parsing", () => {
  it.each([
    ["", null, true],
    ["   ", null, true],
    ["12.34", 1234, true],
    ["12,34", 1234, true],
    ["0", null, false], // zero is not a valid amount, same as the form
    ["-5", null, false],
    ["12.345", null, false],
    ["abc", null, false],
  ])("parseAmountFilter(%j)", (text, cents, valid) => {
    expect(parseAmountFilter(text)).toEqual({ cents, valid });
  });

  it("amountRangeProblem explains what is wrong, or returns null", () => {
    expect(amountRangeProblem("", "", "en-US")).toBeNull();
    expect(amountRangeProblem("10", "", "en-US")).toBeNull();
    expect(amountRangeProblem("", "20", "en-US")).toBeNull();
    expect(amountRangeProblem("10", "10", "en-US")).toBeNull();
    expect(amountRangeProblem("abc", "", "en-US")).toContain("greater than 0");
    expect(amountRangeProblem("20", "10", "en-US")).toContain("minimum can't be higher");
  });
});

describe("hasActiveTxFilters", () => {
  it("is false for the empty filters and for whitespace only", () => {
    expect(hasActiveTxFilters(EMPTY_TX_FILTERS)).toBe(false);
    expect(hasActiveTxFilters(withFilters({ text: "   ", min: " " }))).toBe(false);
  });
  it.each([{ type: "income" as const }, { categoryId: "1" }, { text: "x" }, { min: "1" }, { max: "1" }])(
    "is true when %o is set",
    (o) => expect(hasActiveTxFilters(withFilters(o))).toBe(true),
  );
});

describe("matchesName", () => {
  it.each([
    ["Groceries", "", true],
    ["Groceries", "   ", true],
    ["Groceries", "groc", true],
    ["Groceries", "CERIES", true],
    ["Groceries", "rent", false],
    ["Rent", " rent ", true],
  ])("matchesName(%j, %j) = %s", (name, query, expected) => {
    expect(matchesName(name, query)).toBe(expected);
  });
});

describe("filterBudgets", () => {
  const b = (id: string, remainingCents: number): Budget => ({
    id,
    categoryId: id,
    month: "2026-10",
    limitCents: 50000,
    spentCents: 50000 - remainingCents,
    remainingCents,
  });
  const list = [b("1", 18000), b("2", 0), b("3", -12000)];

  it("all returns every budget", () => expect(filterBudgets(list, "all")).toHaveLength(3));
  it("over = spending above the limit only", () =>
    expect(filterBudgets(list, "over").map((x) => x.id)).toEqual(["3"]));
  it("within includes a budget exactly at its limit", () =>
    expect(filterBudgets(list, "within").map((x) => x.id)).toEqual(["1", "2"]));
});
