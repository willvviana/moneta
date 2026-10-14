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

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
