import type { CategorySpending, MonthRow } from "./reports";

// Pure helpers for the dashboard charts. Amounts stay integer cents; the only fractions here are
// chart geometry (how long an arc or a bar is), never money.

export const CATEGORY_SLOTS = 6; // --cat-1 .. --cat-6 in styles.css

export interface Slice {
  key: string; // category id, or "other"
  name: string;
  cents: number;
  color: string; // a CSS colour, e.g. "var(--cat-3)"
}

// Small stable hash, so a category keeps the same colour from month to month (colour follows the
// category, not its rank). Collisions within one chart are resolved by taking the next free slot.
function homeSlot(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % CATEGORY_SLOTS;
}

// Categories with spending, largest first. With more than CATEGORY_SLOTS categories the smallest
// ones are summed into one neutral "Other" slice, so every slice can have a distinct colour.
// The slices always add up to the sum of the input categories (no cents are lost or invented).
export function buildSlices(categories: CategorySpending[]): Slice[] {
  const spent = categories
    .filter((c) => c.spentCents > 0)
    .sort((a, b) => b.spentCents - a.spentCents || a.categoryName.localeCompare(b.categoryName));
  const named = spent.length > CATEGORY_SLOTS ? spent.slice(0, CATEGORY_SLOTS - 1) : spent;
  const rest = spent.slice(named.length);

  const used = new Set<number>();
  const slices: Slice[] = named.map((c) => {
    let slot = homeSlot(c.categoryId);
    while (used.has(slot)) slot = (slot + 1) % CATEGORY_SLOTS;
    used.add(slot);
    return { key: c.categoryId, name: c.categoryName, cents: c.spentCents, color: `var(--cat-${slot + 1})` };
  });
  if (rest.length > 0) {
    slices.push({
      key: "other",
      name: `Other (${rest.length})`,
      cents: rest.reduce((sum, c) => sum + c.spentCents, 0),
      color: "var(--cat-other)",
    });
  }
  return slices;
}

export interface Arc {
  key: string;
  length: number; // along the circle, in the same units as `circumference`
  offset: number; // where the arc starts
}

// Donut arcs for a circle of the given circumference. `gap` is the visible space between arcs,
// which must also absorb the round line caps (half the stroke width at each end).
export function donutArcs(slices: Slice[], circumference: number, gap: number): Arc[] {
  const total = slices.reduce((sum, s) => sum + s.cents, 0);
  if (total <= 0) return [];
  if (slices.length === 1) return [{ key: slices[0]!.key, length: circumference, offset: 0 }];
  let start = 0;
  return slices.map((s) => {
    const span = (s.cents / total) * circumference;
    // A slice smaller than the gap is still drawn as a dot (a near-zero arc with round caps).
    const arc = { key: s.key, length: Math.max(span - gap, 0.001), offset: start + gap / 2 };
    start += span;
    return arc;
  });
}

export interface NetBar {
  month: string;
  netCents: number;
  heightPct: number; // 0-100, of the plot height
  negative: boolean;
}

// Net cash flow per month as bars around a zero line. `zeroPct` is the zero line's height from the
// bottom: 0 when no month is negative, higher when some are, so both directions fit one scale.
export function netBars(months: MonthRow[]): { zeroPct: number; bars: NetBar[] } {
  const up = Math.max(0, ...months.map((m) => m.netCashFlowCents));
  const down = Math.max(0, ...months.map((m) => -m.netCashFlowCents));
  const range = up + down;
  return {
    zeroPct: range === 0 ? 0 : (down / range) * 100,
    bars: months.map((m) => ({
      month: m.month,
      netCents: m.netCashFlowCents,
      heightPct: range === 0 ? 0 : (Math.abs(m.netCashFlowCents) / range) * 100,
      negative: m.netCashFlowCents < 0,
    })),
  };
}
