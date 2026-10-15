import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { SortableTh } from "../components/SortableTh";
import { matchesName } from "../filters";
import {
  CATEGORY_FIRST_DIR,
  DEFAULT_CATEGORY_SORT,
  DEFAULT_MONTH_SORT,
  MONTH_FIRST_DIR,
  sortCategoryRows,
  sortMonthRows,
  type CategorySortKey,
  type MonthSortKey,
  type SortState,
} from "../sort";
import { formatCents, formatShare, formatSignedCents, percentUsed } from "../money";
import { currentMonth, isMonth, monthLabel, presetRange, rangeProblem, type Preset } from "../month";
import { getOverTime, getSpendingByCategory, type CategoryReport, type OverTimeReport } from "../reports";

type PresetChoice = Preset | "month" | "custom";
const PRESETS: { value: PresetChoice; label: string }[] = [
  { value: "month", label: "Single month" },
  { value: "last3", label: "Last 3 months" },
  { value: "last6", label: "Last 6 months" },
  { value: "last12", label: "Last 12 months" },
  { value: "ytd", label: "Year to date" },
  { value: "custom", label: "Custom range" },
];

const messageOf = (err: unknown) => (err instanceof Error ? err.message : "Unknown error");

// The tables hold the exact numbers; the bars repeat the SAME values visually, so every bar has a text label.
export function Reports() {
  const [preset, setPreset] = useState<PresetChoice>("last6");
  const [range, setRange] = useState(() => presetRange("last6", currentMonth()));
  const [byCategory, setByCategory] = useState<CategoryReport | null>(null);
  const [overTime, setOverTime] = useState<OverTimeReport | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState<CategorySortKey>>(DEFAULT_CATEGORY_SORT);
  const [monthSort, setMonthSort] = useState<SortState<MonthSortKey>>(DEFAULT_MONTH_SORT);
  const latest = useRef(0);

  const problem = rangeProblem(range.from, range.to);

  const load = useCallback(async (from: string, to: string) => {
    const requestId = ++latest.current;
    setLoadState("loading");
    try {
      // Both reports cover the same range, so they are always consistent with each other.
      const [cat, time] = await Promise.all([getSpendingByCategory(from, to), getOverTime(from, to)]);
      if (requestId !== latest.current) return; // superseded by a newer selection
      setByCategory(cat);
      setOverTime(time);
      setLoadState("ready");
    } catch (err) {
      if (requestId !== latest.current) return;
      setLoadError(messageOf(err));
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (problem === null) void load(range.from, range.to);
  }, [range.from, range.to, problem, load]);

  function choosePreset(value: PresetChoice) {
    setPreset(value);
    // "Single month" keeps the month you were already looking at (the end of the range) as from = to.
    if (value === "month") setRange((r) => ({ from: r.to, to: r.to }));
    else if (value !== "custom") setRange(presetRange(value, currentMonth()));
  }

  function setSingleMonth(value: string) {
    if (!isMonth(value)) return; // ignore a cleared/partial month input
    setRange({ from: value, to: value }); // the range is whole months with both ends included
  }

  function setMonthField(field: "from" | "to", value: string) {
    if (!isMonth(value)) return; // ignore a cleared/partial month input
    setPreset("custom");
    setRange((r) => ({ ...r, [field]: value }));
  }

  const maxMonthly = overTime ? Math.max(0, ...overTime.months.flatMap((m) => [m.incomeCents, m.expensesCents])) : 0;
  const noActivity = overTime !== null && overTime.totals.incomeCents === 0 && overTime.totals.expensesCents === 0;

  return (
    <main className="page">
      <PageHeader eyebrow="Analysis" title="Reports" />

      <div className="month-bar no-rule">
        <label className="inline-label">
          Period
          <select value={preset} onChange={(e) => choosePreset(e.target.value as PresetChoice)}>
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {preset === "month" ? (
          <label className="inline-label">
            Month
            <input type="month" value={range.to} onChange={(e) => setSingleMonth(e.target.value)} />
          </label>
        ) : (
          <>
            <label className="inline-label">
              From
              <input type="month" value={range.from} onChange={(e) => setMonthField("from", e.target.value)} />
            </label>
            <label className="inline-label">
              To
              <input type="month" value={range.to} onChange={(e) => setMonthField("to", e.target.value)} />
            </label>
          </>
        )}
        <p className="muted note">
          {preset === "month" ? "One whole month." : "Whole months, both ends included (at most 60 months)."}
        </p>
      </div>

      {problem && (
        <p role="alert" className="error">
          {problem}
        </p>
      )}

      {!problem && loadState === "loading" && <p className="status">Loading…</p>}
      {!problem && loadState === "error" && (
        <div className="status">
          <p className="error">Couldn't load the reports: {loadError}</p>
          <button onClick={() => void load(range.from, range.to)}>Retry</button>
        </div>
      )}

      {!problem && loadState === "ready" && byCategory && overTime && (
        <>
          {noActivity && (
            <p className="status">
              No transactions between {monthLabel(range.from)} and {monthLabel(range.to)}.
            </p>
          )}

          <h2>Spending by category</h2>
          {byCategory.categories.length === 0 ? (
            <p className="muted">No spending in this period.</p>
          ) : (
            <>
              <div className="filters" role="search" aria-label="Filter spending by category">
                <label className="inline-label grow">
                  Search category
                  <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. rent" />
                </label>
                {search.trim() !== "" && (
                  <button type="button" className="secondary" onClick={() => setSearch("")}>
                    Clear filters
                  </button>
                )}
              </div>
              {search.trim() !== "" && (
                <p className="muted note">
                  Showing {byCategory.categories.filter((c) => matchesName(c.categoryName, search)).length} of{" "}
                  {byCategory.categories.length} categories. Shares and the total still cover all spending.
                </p>
              )}
              {byCategory.categories.every((c) => !matchesName(c.categoryName, search)) && (
                <p className="status">
                  No categories match "{search.trim()}".{" "}
                  <button className="secondary" onClick={() => setSearch("")}>
                    Clear filters
                  </button>
                </p>
              )}
            <table>
              <caption className="sr-only">Spending by category, largest first</caption>
              <thead>
                <tr>
                  <SortableTh label="Category" column="category" sort={sort} firstDir={CATEGORY_FIRST_DIR.category} onSort={setSort} />
                  <SortableTh label="Spent" column="spent" sort={sort} firstDir={CATEGORY_FIRST_DIR.spent} onSort={setSort} className="num" />
                  <SortableTh label="Share of spending" column="share" sort={sort} firstDir={CATEGORY_FIRST_DIR.share} onSort={setSort} />
                </tr>
              </thead>
              <tbody>
                {sortCategoryRows(
                  byCategory.categories.filter((c) => matchesName(c.categoryName, search)),
                  sort,
                ).map((c) => {
                  const pct = percentUsed(c.spentCents, byCategory.totalSpentCents);
                  return (
                    <tr key={c.categoryId}>
                      <td>{c.categoryName}</td>
                      <td className="num">{formatCents(c.spentCents)}</td>
                      <td>
                        <span className="share">{formatShare(c.spentCents, byCategory.totalSpentCents)}</span>
                        <span className="cell-bar" aria-hidden="true">
                          <span className="fill share-fill" style={{ width: `${c.spentCents > 0 ? Math.max(pct, 1) : 0}%` }} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th className="num">{formatCents(byCategory.totalSpentCents)}</th>
                  <th />
                </tr>
              </tfoot>
            </table>
            </>
          )}
          <p className="muted note">Expenses only, including categories without a budget. Income is not spending.</p>

          <h2>Income, expenses and net cash flow by month</h2>
          <table>
            <caption className="sr-only">Monthly income, expenses and net cash flow</caption>
            <thead>
              <tr>
                <SortableTh label="Month" column="month" sort={monthSort} firstDir={MONTH_FIRST_DIR.month} onSort={setMonthSort} />
                <SortableTh label="Income" column="income" sort={monthSort} firstDir={MONTH_FIRST_DIR.income} onSort={setMonthSort} />
                <SortableTh label="Expenses" column="expenses" sort={monthSort} firstDir={MONTH_FIRST_DIR.expenses} onSort={setMonthSort} />
                <SortableTh label="Net cash flow" column="net" sort={monthSort} firstDir={MONTH_FIRST_DIR.net} onSort={setMonthSort} className="num" />
              </tr>
            </thead>
            <tbody>
              {sortMonthRows(overTime.months, monthSort).map((m) => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month)}</td>
                  <td>
                    <span className="income-text">{formatCents(m.incomeCents)}</span>
                    <span className="cell-bar" aria-hidden="true">
                      <span className="fill income" style={{ width: `${percentUsed(m.incomeCents, maxMonthly)}%` }} />
                    </span>
                  </td>
                  <td>
                    <span className="expense-text">{formatCents(m.expensesCents)}</span>
                    <span className="cell-bar" aria-hidden="true">
                      <span className="fill spend" style={{ width: `${percentUsed(m.expensesCents, maxMonthly)}%` }} />
                    </span>
                  </td>
                  <td className={`num ${m.netCashFlowCents < 0 ? "expense-text" : m.netCashFlowCents > 0 ? "income-text" : ""}`}>
                    {formatSignedCents(m.netCashFlowCents)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <th>{formatCents(overTime.totals.incomeCents)}</th>
                <th>{formatCents(overTime.totals.expensesCents)}</th>
                <th className="num">{formatSignedCents(overTime.totals.netCashFlowCents)}</th>
              </tr>
            </tfoot>
          </table>
          <p className="muted note">
            Net cash flow is income minus expenses for the month. It is not an account balance. Bars are scaled to the
            largest monthly amount in this period.
          </p>
        </>
      )}
    </main>
  );
}
