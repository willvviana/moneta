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
