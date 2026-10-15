import type { ReactNode } from "react";
import { isMonth, monthLabel, shiftMonth } from "../month";

// Shared month selector: previous/next buttons, a month input, and a readable label.
// `children` is rendered on the right (e.g. an "Add" button).
export function MonthPicker({
  month,
  onChange,
  children,
}: {
  month: string;
  onChange(month: string): void;
  children?: ReactNode;
}) {
  return (
    <div className="month-bar">
      <button className="secondary" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Previous month">
        ‹
      </button>
      <input
        type="month"
        value={month}
        onChange={(e) => isMonth(e.target.value) && onChange(e.target.value)}
        aria-label="Month"
      />
      <button className="secondary" onClick={() => onChange(shiftMonth(month, 1))} aria-label="Next month">
        ›
      </button>
      <strong>{monthLabel(month)}</strong>
      <span className="spacer" />
      {children}
    </div>
  );
}
