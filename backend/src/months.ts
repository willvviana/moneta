import { z } from "zod";

// "YYYY-MM", years 1900-2099 (PostgreSQL has no year 0, and nothing here needs more range).
export const yearMonth = z.string().regex(/^(19|20)\d{2}-(0[1-9]|1[0-2])$/, "must be YYYY-MM");

// Half-open bounds for a month: from = first day (included), to = first day of the NEXT month (excluded).
export function monthBounds(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const next = y * 12 + m; // months since year 0, of the following month (m is 1-based)
  const ny = Math.floor(next / 12);
  const nm = (next % 12) + 1;
  return { from: `${ym}-01`, to: `${ny}-${String(nm).padStart(2, "0")}-01` };
}

// ---- Report periods: an INCLUSIVE range of whole months -------------------------------------
// from=2026-01&to=2026-03 means January, February and March: 3 months.

export const MAX_REPORT_MONTHS = 60;

// Number of calendar months included, both ends counted (same month = 1).
export function monthCount(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number) as [number, number];
  const [ty, tm] = to.split("-").map(Number) as [number, number];
  return ty * 12 + tm - (fy * 12 + fm) + 1;
}

// Half-open date range covering every month in the inclusive range:
// [first day of `from`, first day of the month AFTER `to`).
export function rangeBounds(from: string, to: string): { from: string; to: string } {
  return { from: `${from}-01`, to: monthBounds(to).to };
}

export const monthRangeQuery = z
  .object({ from: yearMonth, to: yearMonth })
  .superRefine((v, ctx) => {
    if (v.from > v.to) {
      // "YYYY-MM" strings sort chronologically, so plain comparison is correct.
      ctx.addIssue({ code: "custom", path: ["from"], message: "must not be after 'to'" });
    } else if (monthCount(v.from, v.to) > MAX_REPORT_MONTHS) {
      ctx.addIssue({ code: "custom", path: ["to"], message: `range cannot exceed ${MAX_REPORT_MONTHS} months` });
    }
  });
