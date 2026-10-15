// Months are "YYYY-MM" strings. The range sent to the API is half-open, matching the
// backend: from = first day of the month (included), to = first day of NEXT month (excluded).

const pad2 = (n: number) => String(n).padStart(2, "0");

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; // local date, not UTC
}

export function isMonth(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const index = y * 12 + (m - 1) + delta; // months since year 0: integer math handles year rollover
  return `${Math.floor(index / 12)}-${pad2((index % 12) + 1)}`.padStart(7, "0");
}

export function monthRange(ym: string): { from: string; to: string } {
  return { from: `${ym}-01`, to: `${shiftMonth(ym, 1)}-01` };
}

// ---- Report periods: an INCLUSIVE range of whole months ("2026-01" to "2026-03" = 3 months) ----

export const MAX_REPORT_MONTHS = 60; // must match the backend

export function rangeCount(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number) as [number, number];
  const [ty, tm] = to.split("-").map(Number) as [number, number];
  return ty * 12 + tm - (fy * 12 + fm) + 1;
}

// Returns a message when the range can't be requested, or null when it is fine.
export function rangeProblem(from: string, to: string): string | null {
  if (!isMonth(from) || !isMonth(to)) return "Choose a start and an end month.";
  if (from > to) return "The start month must not be after the end month."; // "YYYY-MM" sorts chronologically
  if (rangeCount(from, to) > MAX_REPORT_MONTHS) return `Choose at most ${MAX_REPORT_MONTHS} months.`;
  return null;
}

export type Preset = "last3" | "last6" | "last12" | "ytd";

// Presets end at `current` (the current month) and include it.
export function presetRange(preset: Preset, current: string): { from: string; to: string } {
  const year = current.slice(0, 4);
  switch (preset) {
    case "last3":
      return { from: shiftMonth(current, -2), to: current };
    case "last6":
      return { from: shiftMonth(current, -5), to: current };
    case "last12":
      return { from: shiftMonth(current, -11), to: current };
    case "ytd":
      return { from: `${year}-01`, to: current };
  }
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
