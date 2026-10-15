// Money helpers. The API's integer cents are the source of truth; dollars exist only
// as text at the form boundary. Nothing here multiplies or divides a floating-point dollar value.

// "12.34" or "12,34" -> 1234. Pure string parsing: digits, then an optional "." or ","
// followed by 1-2 decimals. A comma followed by 3 digits ("1,234") is deliberately rejected:
// it is ambiguous (thousands separator vs. decimal) and guessing wrong would silently
// store the wrong amount.
// Returns null for anything else (negative, "1e3", "12.345", empty, zero).
export function parseDollarsToCents(input: string): number | null {
  const m = /^(\d{1,12})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const dollars = Number(m[1]); // up to 12 digits: exactly representable
  const cents = Number((m[2] ?? "").padEnd(2, "0"));
  const total = dollars * 100 + cents; // integer arithmetic, < 1e14: stays a safe integer
  return total > 0 ? total : null;
}

// 1234 -> "12.34" (for pre-filling an edit form).
export function centsToInput(cents: number): string {
  const rem = cents % 100;
  return `${(cents - rem) / 100}.${String(rem).padStart(2, "0")}`;
}

// How much of the limit is used, as a whole percent (floored). May exceed 100 when over budget.
// BigInt keeps the multiplication exact for any safe-integer cents; this is presentation only,
// the server owns the real numbers (spent, remaining).
export function percentUsed(spentCents: number, limitCents: number): number {
  if (limitCents <= 0) return 0;
  return Number((BigInt(spentCents) * 100n) / BigInt(limitCents));
}

// 18000 -> "$180.00 left", -12000 -> "Over by $120.00". Zero remaining is "at the limit", not over.
export function describeRemaining(remainingCents: number): string {
  return remainingCents < 0 ? `Over by ${formatCents(-remainingCents)}` : `${formatCents(remainingCents)} left`;
}

// 1234567 -> "$12,345.67". (cents - rem) is an exact multiple of 100, so the division is exact.
export function formatCents(cents: number): string {
  const rem = cents % 100;
  const dollars = (cents - rem) / 100;
  return `$${dollars.toLocaleString("en-US")}.${String(rem).padStart(2, "0")}`;
}
