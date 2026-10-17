import { describe, expect, it } from "vitest";
import {
  centsToInput,
  describeRemaining,
  formatCents,
  formatCentsShort,
  formatShare,
  formatSignedCents,
  parseDollarsToCents,
  percentUsed,
} from "./money";

// CONTRACT of parseDollarsToCents (what these tests pin down):
//  - Input is trimmed. Accepted shape: 1-12 digits, then optionally "." or "," and 1-2 digits.
//  - Result is integer cents, computed with integer math only. Zero is NOT a valid amount.
//  - Everything else returns null. In particular "1,234" is rejected on purpose: a comma
//    followed by 3 digits is ambiguous (thousands separator vs. decimal), and guessing
//    wrong would silently store the wrong amount.

describe("parseDollarsToCents: accepted input", () => {
  it.each([
    ["12.34", 1234],
    ["12,34", 1234], // comma as decimal separator
    ["12", 1200],
    ["12.3", 1230], // one decimal digit means tenths
    ["12,5", 1250],
    ["0.01", 1], // smallest valid amount
    ["0,05", 5],
    ["  12.34  ", 1234], // surrounding whitespace ignored
    ["007.50", 750], // leading zeros are harmless
    ["999999999999.99", 99999999999999], // 12 digits: the maximum, still a safe integer
  ])("parses %j to %d cents", (input, cents) => {
    expect(parseDollarsToCents(input)).toBe(cents);
  });

  it("always returns a safe integer for the maximum input", () => {
    expect(Number.isSafeInteger(parseDollarsToCents("999999999999.99"))).toBe(true);
  });
});

describe("parseDollarsToCents: rejected input", () => {
  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
    ["zero", "0"],
    ["zero with decimals", "0.00"],
    ["negative", "-5"],
    ["negative decimal", "-0.50"],
    ["three decimals (dot)", "12.345"],
    ["three decimals (comma), ambiguous", "1,234"],
    ["thousands separator with decimals", "1,234.56"],
    ["two separators", "12.34.56"],
    ["no leading digits", ".5"],
    ["trailing separator", "12."],
    ["exponent notation", "1e3"],
    ["currency symbol", "$12"],
    ["letters", "abc"],
    ["13 digits (over the limit)", "1000000000000"],
  ])("returns null for %s: %j", (_label, input) => {
    expect(parseDollarsToCents(input)).toBeNull();
  });
});

describe("formatCents", () => {
  it.each([
    [0, "$0.00"],
    [5, "$0.05"], // cents are zero-padded
    [100, "$1.00"],
    [1234, "$12.34"],
    [123456789, "$1,234,567.89"], // thousands separators on the dollars only
    [99999999999999, "$999,999,999,999.99"],
  ])("formats %d cents as %s", (cents, text) => {
    expect(formatCents(cents, "en-US")).toBe(text);
  });
});

describe("formatSignedCents", () => {
  it.each([
    [140000, "+$1,400.00"],
    [-11345, "−$113.45"], // typographic minus, like the transactions table
    [1, "+$0.01"],
    [-1, "−$0.01"],
    [0, "$0.00"], // zero carries no sign
  ])("%d cents reads %j", (cents, text) => {
    expect(formatSignedCents(cents, "en-US")).toBe(text);
  });
});

describe("percentUsed", () => {
  it.each([
    [32000, 50000, 64], // the $320 of $500 example
    [0, 50000, 0],
    [50000, 50000, 100], // exactly at the limit
    [62000, 50000, 124], // over budget: not capped here (the bar caps it visually)
    [1, 3, 33], // floored, never rounded up
    [99999999999999, 100000000000000, 99], // large values stay exact (BigInt)
  ])("spent %d of limit %d is %d%%", (spent, limit, pct) => {
    expect(percentUsed(spent, limit)).toBe(pct);
  });

  it("a non-positive limit yields 0 instead of dividing by zero", () => {
    expect(percentUsed(100, 0)).toBe(0);
  });
});

describe("formatShare", () => {
  it.each([
    [15000, 17500, "85%"],
    [17500, 17500, "100%"],
    [0, 17500, "0%"], // nothing spent
    [1, 100000, "<1%"], // tiny but non-zero is not shown as 0%
    [1, 3, "33%"],
    [100, 0, "0%"], // zero total: explicit, no division by zero
    [0, 0, "0%"],
  ])("%d of %d reads %j", (part, total, text) => {
    expect(formatShare(part, total)).toBe(text);
  });
});

describe("describeRemaining", () => {
  it.each([
    [18000, "$180.00 left"],
    [0, "$0.00 left"], // at the limit is not "over"
    [1, "$0.01 left"],
    [-12000, "Over by $120.00"],
    [-1, "Over by $0.01"],
  ])("%d cents remaining reads %j", (remaining, text) => {
    expect(describeRemaining(remaining, "en-US")).toBe(text);
  });
});

describe("centsToInput", () => {
  it.each([
    [1, "0.01"],
    [5, "0.05"],
    [100000, "1000.00"], // no thousands separator: the result must be parseable again
    [1234, "12.34"],
  ])("converts %d cents to %s", (cents, text) => {
    expect(centsToInput(cents, "en-US")).toBe(text);
  });

  it("round-trips: parsing what an edit form shows gives back the same cents", () => {
    for (const cents of [1, 9, 10, 99, 100, 101, 1234, 100000, 99999999999999]) {
      expect(parseDollarsToCents(centsToInput(cents, "en-US"))).toBe(cents);
    }
  });
});

describe("formatCentsShort", () => {
  it("rounds half up to whole dollars", () => {
    expect(formatCentsShort(514000, "en-US")).toBe("$5,140");
    expect(formatCentsShort(514049, "en-US")).toBe("$5,140");
    expect(formatCentsShort(514050, "en-US")).toBe("$5,141");
    expect(formatCentsShort(0, "en-US")).toBe("$0");
  });

  it("switches to thousands from $100,000", () => {
    expect(formatCentsShort(9_999_949, "en-US")).toBe("$99,999");
    expect(formatCentsShort(12_345_678, "en-US")).toBe("$123k");
    expect(formatCentsShort(12_350_000, "en-US")).toBe("$124k");
  });

  it("keeps the sign for negatives", () => {
    expect(formatCentsShort(-514050, "en-US")).toBe("−$5,141");
  });
});
