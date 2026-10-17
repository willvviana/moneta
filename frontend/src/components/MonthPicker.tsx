import type { ReactNode } from "react";
import { useI18n } from "../i18n/locale";
import { isMonth, shiftMonth } from "../month";

// Shared month selector: previous/next buttons around a month input (which already shows the month by name).
// `children` is rendered on the right (e.g. an "Add" button).
// Note: the browser draws the month input in ITS OWN language, not the app's.
export function MonthPicker({
  month,
  onChange,
  children,
}: {
  month: string;
  onChange(month: string): void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="month-bar">
      <button className="secondary" onClick={() => onChange(shiftMonth(month, -1))} aria-label={t.monthPicker.previous}>
        ‹
      </button>
      <input
        type="month"
        value={month}
        onChange={(e) => isMonth(e.target.value) && onChange(e.target.value)}
        aria-label={t.common.month}
      />
      <button className="secondary" onClick={() => onChange(shiftMonth(month, 1))} aria-label={t.monthPicker.next}>
        ›
      </button>
      <span className="spacer" />
      {children}
    </div>
  );
}
