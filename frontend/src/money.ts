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

// Signed amount for net figures: 140000 -> "+$1,400.00", -11345 -> "−$113.45", 0 -> "$0.00".
export function formatSignedCents(cents: number): string {
  if (cents === 0) return formatCents(0);
  return cents < 0 ? `−${formatCents(-cents)}` : `+${formatCents(cents)}`;
}

// How much of the limit is used, as a whole percent (floored). May exceed 100 when over budget.
// BigInt keeps the multiplication exact for any safe-integer cents; this is presentation only,
// the server owns the real numbers (spent, remaining).
export function percentUsed(spentCents: number, limitCents: number): number {
  if (limitCents <= 0) return 0;
  return Number((BigInt(spentCents) * 100n) / BigInt(limitCents));
}

// Share of a total as text. A zero total is handled explicitly (no division by zero), and a
// non-zero amount that floors to 0% reads "<1%" so it doesn't look like nothing was spent.
export function formatShare(partCents: number, totalCents: number): string {
  if (totalCents <= 0) return "0%";
  const pct = percentUsed(partCents, totalCents);
  return partCents > 0 && pct === 0 ? "<1%" : `${pct}%`;
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

// Short label for chart centres, rounded half up to whole dollars: 514000 -> "$5,140", 514050 -> "$5,141".
// From $100,000 it switches to thousands: 12345678 -> "$123k". Integer arithmetic only. The exact
// amount must be shown (or available to screen readers) next to it.
export function formatCentsShort(cents: number): string {
  if (cents < 0) return `−${formatCentsShort(-cents)}`;
  const dollars = (cents + 50 - ((cents + 50) % 100)) / 100;
  if (dollars < 100_000) return `$${dollars.toLocaleString("en-US")}`;
  const thousands = (dollars + 500 - ((dollars + 500) % 1000)) / 1000;
  return `$${thousands.toLocaleString("en-US")}k`;
}
