import { describe, expect, it } from "vitest";
import { buildSlices, CATEGORY_SLOTS, donutArcs, netBars } from "./charts";
import type { CategorySpending } from "./reports";

const cat = (id: string, cents: number): CategorySpending => ({ categoryId: id, categoryName: id.toUpperCase(), spentCents: cents });

describe("buildSlices", () => {
  it("drops zero spending and sorts largest first", () => {
    const slices = buildSlices([cat("a", 100), cat("b", 0), cat("c", 300)]);
    expect(slices.map((s) => s.key)).toEqual(["c", "a"]);
  });

  it("folds the smallest categories into Other and keeps the total exact", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => cat(`c${n}`, n * 1001));
    const slices = buildSlices(input);
    expect(slices).toHaveLength(CATEGORY_SLOTS);
    expect(slices.at(-1)).toMatchObject({ key: "other", name: "Other (3)", cents: (1 + 2 + 3) * 1001, color: "var(--cat-other)" });
    const sum = (xs: { cents?: number; spentCents?: number }[]) => xs.reduce((t, x) => t + (x.cents ?? x.spentCents ?? 0), 0);
    expect(sum(slices)).toBe(sum(input));
  });

  it("gives every named slice a distinct colour, and the same category the same colour regardless of rank", () => {
    const a = buildSlices([cat("food", 500), cat("rent", 900), cat("fun", 100)]);
    expect(new Set(a.map((s) => s.color)).size).toBe(3);
    const b = buildSlices([cat("food", 999), cat("rent", 1)]);
    const color = (xs: typeof a, key: string) => xs.find((s) => s.key === key)!.color;
    expect(color(b, "food")).toBe(color(a, "food"));
  });

  it("handles no spending", () => {
    expect(buildSlices([])).toEqual([]);
  });
});

describe("donutArcs", () => {
  const slice = (key: string, cents: number) => ({ key, name: key, cents, color: "" });

  it("splits the circle in proportion, minus the gaps", () => {
    const arcs = donutArcs([slice("a", 300), slice("b", 100)], 100, 4);
    expect(arcs).toEqual([
      { key: "a", length: 71, offset: 2 },
      { key: "b", length: 21, offset: 77 },
    ]);
  });

  it("draws a single slice as a full ring and nothing for no spending", () => {
    expect(donutArcs([slice("a", 5)], 100, 4)).toEqual([{ key: "a", length: 100, offset: 0 }]);
    expect(donutArcs([], 100, 4)).toEqual([]);
  });

  it("keeps a tiny slice visible as a dot", () => {
    const arcs = donutArcs([slice("a", 100000), slice("b", 1)], 100, 4);
    expect(arcs[1]!.length).toBeGreaterThan(0);
  });
});

describe("netBars", () => {
  const row = (month: string, net: number) => ({ month, incomeCents: 0, expensesCents: 0, netCashFlowCents: net });

  it("puts the zero line at the bottom when nothing is negative", () => {
    const { zeroPct, bars } = netBars([row("2026-01", 500), row("2026-02", 1000)]);
    expect(zeroPct).toBe(0);
    expect(bars.map((b) => b.heightPct)).toEqual([50, 100]);
  });

  it("shares one scale between positive and negative months", () => {
    const { zeroPct, bars } = netBars([row("2026-01", 300), row("2026-02", -100)]);
    expect(zeroPct).toBe(25);
    expect(bars.map((b) => [b.heightPct, b.negative])).toEqual([[75, false], [25, true]]);
  });

  it("handles all-zero months without dividing by zero", () => {
    const { zeroPct, bars } = netBars([row("2026-01", 0)]);
    expect(zeroPct).toBe(0);
    expect(bars[0]!.heightPct).toBe(0);
  });
});
