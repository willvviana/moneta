import { z } from "zod";
import { AppError } from "./errors.js";

// Real calendar date as YYYY-MM-DD. The round trip rejects things like 2026-02-30,
// which a regex alone would accept.
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "not a real calendar date")
  // PostgreSQL has no year 0 and would throw (-> 500). Keep to a sane, supported range.
  .refine((s) => Number(s.slice(0, 4)) >= 1900 && Number(s.slice(0, 4)) <= 2099, "year must be 1900-2099");

// BIGINT ids travel as strings (JS numbers can't represent all of them). Max 15 digits keeps us in range.
export const idString = z.string().regex(/^\d{1,15}$/, "invalid id");

// Path ids: anything malformed is simply "not found" (404), not a validation detail.
export function parseId(raw: unknown): string {
  if (typeof raw !== "string" || !/^\d{1,15}$/.test(raw)) throw new AppError(404, "NOT_FOUND", "Not found");
  return raw;
}

export function parseInput<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    throw new AppError(400, "VALIDATION", msg);
  }
  return result.data;
}
