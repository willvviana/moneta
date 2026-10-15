// Safe handling of money values that come back from SQL aggregates.
// PostgreSQL SUM() returns NUMERIC, which the driver delivers as a string. Converting it to a JS
// number is only safe below 2^53, so every conversion goes through here and fails loudly
// instead of returning a silently rounded amount.

export function toSafeCents(value: string | number, what: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error(`${what} is outside the safe integer range: ${value}`);
  return n;
}

// Sums non-negative cent values, checking after every step that the running total is still exact.
export function sumCents(values: number[], what: string): number {
  let total = 0;
  for (const v of values) {
    total += v;
    if (!Number.isSafeInteger(total)) throw new Error(`${what} total is outside the safe integer range`);
  }
  return total;
}
