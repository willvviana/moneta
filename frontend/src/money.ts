import { MESSAGES } from "./i18n/messages";
import type { Lang } from "./i18n/locale";

// Money helpers. The API's integer cents are the source of truth; dollars exist only
// as text at the form boundary. Nothing here multiplies or divides a floating-point dollar value.
//
// The language decides how an amount is WRITTEN: en-US "$1,234.56", pt-BR "R$ 1.234,56". The cents are
// the same either way; nothing is converted (see docs/DECISIONS.md). Digit grouping is done here with
// integer/string operations instead of Intl, so the output is exact and identical in every browser.
const FORMAT: Record<Lang, { symbol: string; group: string; decimal: string; thousands: string }> = {
  "en-US": { symbol: "$", group: ",", decimal: ".", thousands: "k" },
  // A no-break space after R$ (and before "mil") keeps the symbol and the number on one line.
  "pt-BR": { symbol: "R$\u00a0", group: ".", decimal: ",", thousands: "\u00a0mil" },
};

// 1234567 -> "1,234,567" (en-US) or "1.234.567" (pt-BR). Non-negative integers only.
function groupDigits(n: number, lang: Lang): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, FORMAT[lang].group);
}

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

// 1234 -> "12.34" (en-US) or "12,34" (pt-BR), for pre-filling an edit form. parseDollarsToCents accepts both.
export function centsToInput(cents: number, lang: Lang): string {
  const rem = cents % 100;
  return `${(cents - rem) / 100}${FORMAT[lang].decimal}${String(rem).padStart(2, "0")}`;
}

// Signed amount for net figures: 140000 -> "+$1,400.00", -11345 -> "−$113.45", 0 -> "$0.00".
export function formatSignedCents(cents: number, lang: Lang): string {
  if (cents === 0) return formatCents(0, lang);
  return cents < 0 ? `−${formatCents(-cents, lang)}` : `+${formatCents(cents, lang)}`;
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
export function describeRemaining(remainingCents: number, lang: Lang): string {
  const m = MESSAGES[lang].money;
  return remainingCents < 0 ? m.overBy(formatCents(-remainingCents, lang)) : m.remaining(formatCents(remainingCents, lang));
}

// 1234567 -> "$12,345.67" / "R$ 12.345,67". (cents - rem) is an exact multiple of 100, so the division is exact.
// Non-negative amounts; signed figures go through formatSignedCents.
export function formatCents(cents: number, lang: Lang): string {
  const f = FORMAT[lang];
  const rem = cents % 100;
  const dollars = (cents - rem) / 100;
  return `${f.symbol}${groupDigits(dollars, lang)}${f.decimal}${String(rem).padStart(2, "0")}`;
}

// Short label for chart centres, rounded half up to whole dollars: 514000 -> "$5,140", 514050 -> "$5,141".
// From $100,000 it switches to thousands: 12345678 -> "$123k" / "R$ 123 mil". Integer arithmetic only.
// The exact amount must be shown (or available to screen readers) next to it.
export function formatCentsShort(cents: number, lang: Lang): string {
  if (cents < 0) return `−${formatCentsShort(-cents, lang)}`;
  const f = FORMAT[lang];
  const dollars = (cents + 50 - ((cents + 50) % 100)) / 100;
  if (dollars < 100_000) return `${f.symbol}${groupDigits(dollars, lang)}`;
  const thousands = (dollars + 500 - ((dollars + 500) % 1000)) / 1000;
  return `${f.symbol}${groupDigits(thousands, lang)}${f.thousands}`;
}
