import { afterEach, describe, expect, it, vi } from "vitest";
import {
  currentMonth,
  isMonth,
  monthLabel,
  monthRange,
  presetRange,
  rangeCount,
  rangeProblem,
  shiftMonth,
  todayISO,
} from "./month";

// CONTRACT: months are "YYYY-MM". monthRange returns the HALF-OPEN range the API expects:
// `from` is the first day of the month (included), `to` is the first day of the NEXT month (excluded).

describe("shiftMonth", () => {
  it.each([
    ["2026-10", 0, "2026-10"],
    ["2026-10", 1, "2026-11"],
    ["2026-10", -1, "2026-09"],
    ["2026-12", 1, "2027-01"], // December -> January rolls the year forward
    ["2026-01", -1, "2025-12"], // January -> December rolls the year back
    ["2026-01", 12, "2027-01"],
    ["2026-03", -15, "2024-12"],
  ])("shiftMonth(%s, %d) = %s", (ym, delta, expected) => {
    expect(shiftMonth(ym, delta)).toBe(expected);
  });
});

describe("monthRange", () => {
  it.each([
    ["2026-10", "2026-10-01", "2026-11-01"],
    ["2026-12", "2026-12-01", "2027-01-01"], // year boundary
    ["2026-02", "2026-02-01", "2026-03-01"], // short month: still the 1st of the next month
    ["2028-02", "2028-02-01", "2028-03-01"], // leap year
  ])("%s -> [%s, %s)", (ym, from, to) => {
    expect(monthRange(ym)).toEqual({ from, to });
  });

  it("last day of a month is inside its range; first day of the next month is not", () => {
    const { from, to } = monthRange("2026-10");
    const inRange = (d: string) => d >= from && d < to; // same comparison the UI and backend use
    expect(inRange("2026-10-01")).toBe(true);
    expect(inRange("2026-10-31")).toBe(true);
    expect(inRange("2026-11-01")).toBe(false);
    expect(inRange("2026-09-30")).toBe(false);
  });

  it("adjacent months never overlap or leave a gap", () => {
    expect(monthRange("2026-10").to).toBe(monthRange("2026-11").from);
    expect(monthRange("2026-12").to).toBe(monthRange("2027-01").from);
  });
});

describe("isMonth", () => {
  it.each(["2026-10", "2026-01", "2026-12"])("accepts %j", (s) => expect(isMonth(s)).toBe(true));
  it.each(["", "2026-13", "2026-00", "26-10", "2026-1", "2026-10-01", "abcd-ef"])("rejects %j", (s) =>
    expect(isMonth(s)).toBe(false),
  );
});

describe("monthLabel", () => {
  it("formats a readable month and year", () => {
    expect(monthLabel("2026-10", "en-US")).toBe("October 2026");
    expect(monthLabel("2027-01", "en-US")).toBe("January 2027");
  });
});

describe("report ranges (inclusive months)", () => {
  it.each([
    ["2026-01", "2026-03", 3],
    ["2026-05", "2026-05", 1], // same month counts as 1
    ["2025-12", "2026-01", 2], // year boundary
    ["2021-01", "2025-12", 60],
    ["2021-01", "2026-01", 61],
  ])("rangeCount(%s, %s) = %d", (from, to, n) => expect(rangeCount(from, to)).toBe(n));

  it("accepts valid ranges: one month, and exactly 60 months", () => {
    expect(rangeProblem("2026-05", "2026-05", "en-US")).toBeNull();
    expect(rangeProblem("2021-01", "2025-12", "en-US")).toBeNull();
  });

  it.each([
    ["2026-03", "2026-01", "start month must not be after"],
    ["2021-01", "2026-01", "at most 60"], // 61 months
    ["", "2026-01", "Choose a start and an end month"],
    ["2026-01", "2026-13", "Choose a start and an end month"],
  ])("rangeProblem(%j, %j) explains the problem", (from, to, fragment) => {
    expect(rangeProblem(from, to, "en-US")).toContain(fragment);
  });

  it.each([
    ["last3", "2026-10", "2026-08", "2026-10"],
    ["last6", "2026-10", "2026-05", "2026-10"],
    ["last12", "2026-10", "2025-11", "2026-10"],
    ["ytd", "2026-10", "2026-01", "2026-10"],
    ["last6", "2026-02", "2025-09", "2026-02"], // reaches back across New Year
    ["ytd", "2026-01", "2026-01", "2026-01"], // January: year to date is one month
  ] as const)("preset %s ending %s covers %s to %s", (preset, current, from, to) => {
    expect(presetRange(preset, current)).toEqual({ from, to });
  });

  it("every preset is a valid range within the cap", () => {
    for (const p of ["last3", "last6", "last12", "ytd"] as const) {
      const { from, to } = presetRange(p, "2026-10");
      expect(rangeProblem(from, to, "en-US")).toBeNull();
    }
  });
});

describe("clock-based helpers", () => {
  afterEach(() => vi.useRealTimers());

  it("currentMonth and todayISO use the LOCAL date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 14, 12, 0)); // 14 Oct 2026, local time
    expect(currentMonth()).toBe("2026-10");
    expect(todayISO()).toBe("2026-10-14");
  });

  it("late on the last day of the year is still that local day (not UTC's next day)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31, 23, 30)); // 31 Dec 2026, 23:30 local
    expect(todayISO()).toBe("2026-12-31");
    expect(currentMonth()).toBe("2026-12");
  });
});
