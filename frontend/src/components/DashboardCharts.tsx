import { useState } from "react";
import { donutArcs, netBars, type Slice } from "../charts";
import { useI18n } from "../i18n/locale";
import { formatCents, formatCentsShort, formatShare, formatSignedCents } from "../money";
import { monthLabel, shortMonth } from "../month";
import type { MonthRow } from "../reports";

// Donut geometry, in SVG user units (the viewBox is 100 x 100).
const RADIUS = 42;
const STROKE = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = STROKE + 3; // the round caps take STROKE/2 at each end; 3 units stay visible between arcs

// Spending by category: a donut with a legend. Hovering a slice or a legend row highlights both and
// shows that category's amount in the centre. The legend carries names, amounts and shares as text,
// so nothing depends on telling the colours apart.
export function SpendingDonut({ slices, totalCents, caption }: { slices: Slice[]; totalCents: number; caption: string }) {
  const { lang } = useI18n();
  const [active, setActive] = useState<string | null>(null);
  const arcs = donutArcs(slices, CIRCUMFERENCE, GAP);
  const focused = slices.find((s) => s.key === active);

  return (
    <div className="donut-layout">
      <div className={focused ? "donut focused" : "donut"}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--bar-track)" strokeWidth={STROKE} opacity={arcs.length ? 0 : 1} />
          <g transform="rotate(-90 50 50)">
            {arcs.map((a) => {
              const slice = slices.find((s) => s.key === a.key)!;
              return (
                <circle
                  key={a.key}
                  className={a.key === active ? "donut-seg on" : "donut-seg"}
                  cx="50"
                  cy="50"
                  r={RADIUS}
                  stroke={slice.color}
                  strokeWidth={STROKE}
                  strokeLinecap={arcs.length === 1 ? "butt" : "round"}
                  strokeDasharray={`${a.length} ${CIRCUMFERENCE - a.length}`}
                  strokeDashoffset={-a.offset}
                  onMouseEnter={() => setActive(a.key)}
                  onMouseLeave={() => setActive(null)}
                />
              );
            })}
          </g>
        </svg>
        <div className="donut-center">
          <span className="donut-value" aria-hidden="true">
            {formatCentsShort(focused ? focused.cents : totalCents, lang)}
          </span>
          <span className="donut-caption">{focused ? focused.name : caption}</span>
          <span className="sr-only">
            {formatCents(totalCents, lang)} {caption}
          </span>
        </div>
      </div>

      <ul className="legend">
        {slices.map((s) => (
          <li
            key={s.key}
            className={s.key === active ? "on" : undefined}
            onMouseEnter={() => setActive(s.key)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="legend-dot" style={{ background: s.color }} aria-hidden="true" />
            <span className="legend-name">{s.name}</span>
            <span className="legend-amount">{formatCents(s.cents, lang)}</span>
            <span className="legend-share">{formatShare(s.cents, totalCents)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Net cash flow for the last few months as soft bars; the selected month is highlighted.
// Each bar is a button that switches the dashboard to that month. Negative months hang below a zero line.
export function NetByMonth({ months, selected, onSelect }: { months: MonthRow[]; selected: string; onSelect(month: string): void }) {
  const { lang, t } = useI18n();
  const [hovered, setHovered] = useState<string | null>(null);
  const { zeroPct, bars } = netBars(months);
  const shown = bars.find((b) => b.month === (hovered ?? selected));

  return (
    <>
      <div className="panel-head">
        <p className="panel-title">{t.charts.netByMonth}</p>
        <span className="panel-meta" aria-live="polite">
          {shown ? `${monthLabel(shown.month, lang)}: ${formatSignedCents(shown.netCents, lang)}` : ""}
        </span>
      </div>
      <div className="month-bars">
        {bars.map((b) => {
          const style = b.negative
            ? { top: `${100 - zeroPct}%`, height: `max(4px, ${b.heightPct}%)` }
            : { bottom: `${zeroPct}%`, height: `max(4px, ${b.heightPct}%)` };
          return (
            <button
              key={b.month}
              type="button"
              className={b.month === selected ? "month-col selected" : "month-col"}
              aria-label={t.charts.barAria(monthLabel(b.month, lang), formatSignedCents(b.netCents, lang))}
              aria-pressed={b.month === selected}
              onClick={() => onSelect(b.month)}
              onMouseEnter={() => setHovered(b.month)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(b.month)}
              onBlur={() => setHovered(null)}
            >
              <span className="month-plot" aria-hidden="true">
                {zeroPct > 0 && <span className="month-zero" style={{ bottom: `${zeroPct}%` }} />}
                <span className={b.negative ? "month-bar-fill negative" : "month-bar-fill"} style={style} />
              </span>
              <span className="month-name" aria-hidden="true">
                {shortMonth(b.month, lang)}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
