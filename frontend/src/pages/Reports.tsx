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
import { errorText } from "../i18n/errors";
import { useI18n } from "../i18n/locale";
import { formatCents, formatShare, formatSignedCents, percentUsed } from "../money";
import { currentMonth, isMonth, MAX_REPORT_MONTHS, monthLabel, presetRange, rangeProblem, type Preset } from "../month";
import { getOverTime, getSpendingByCategory, type CategoryReport, type OverTimeReport } from "../reports";

type PresetChoice = Preset | "month" | "custom";
const PRESETS: PresetChoice[] = ["month", "last3", "last6", "last12", "ytd", "custom"]; // labels: reports.presets

// The tables hold the exact numbers; the bars repeat the SAME values visually, so every bar has a text label.
export function Reports() {
  const { lang, t } = useI18n();
  const p = t.reports;
  const [preset, setPreset] = useState<PresetChoice>("last6");
  const [range, setRange] = useState(() => presetRange("last6", currentMonth()));
  const [byCategory, setByCategory] = useState<CategoryReport | null>(null);
  const [overTime, setOverTime] = useState<OverTimeReport | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<unknown>(null); // translated when shown
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState<CategorySortKey>>(DEFAULT_CATEGORY_SORT);
  const [monthSort, setMonthSort] = useState<SortState<MonthSortKey>>(DEFAULT_MONTH_SORT);
  const latest = useRef(0);

  const problem = rangeProblem(range.from, range.to, lang);

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
      setLoadError(err);
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
      <PageHeader eyebrow={p.eyebrow} title={p.title} />

      <div className="month-bar no-rule">
        <label className="inline-label">
          {p.period}
          <select value={preset} onChange={(e) => choosePreset(e.target.value as PresetChoice)}>
            {PRESETS.map((value) => (
              <option key={value} value={value}>
                {p.presets[value]}
              </option>
            ))}
          </select>
        </label>
        {preset === "month" ? (
          <label className="inline-label">
            {t.common.month}
            <input type="month" value={range.to} onChange={(e) => setSingleMonth(e.target.value)} />
          </label>
        ) : (
          <>
            <label className="inline-label">
              {p.from}
              <input type="month" value={range.from} onChange={(e) => setMonthField("from", e.target.value)} />
            </label>
            <label className="inline-label">
              {p.to}
              <input type="month" value={range.to} onChange={(e) => setMonthField("to", e.target.value)} />
            </label>
          </>
        )}
        <p className="muted note">
          {preset === "month" ? p.singleNote : p.rangeNote(MAX_REPORT_MONTHS)}
        </p>
      </div>

      {problem && (
        <p role="alert" className="error">
          {problem}
        </p>
      )}

      {!problem && loadState === "loading" && <p className="status">{t.common.loading}</p>}
      {!problem && loadState === "error" && (
        <div className="status">
          <p className="error">{p.loadFailed(errorText(loadError, lang))}</p>
          <button onClick={() => void load(range.from, range.to)}>{t.common.retry}</button>
        </div>
      )}

      {!problem && loadState === "ready" && byCategory && overTime && (
        <>
          {noActivity && (
            <p className="status">
              {p.noActivity(monthLabel(range.from, lang), monthLabel(range.to, lang))}
            </p>
          )}

          <h2>{p.spendingByCategory}</h2>
          {byCategory.categories.length === 0 ? (
            <p className="muted">{p.noSpending}</p>
          ) : (
            <>
              <div className="filters" role="search" aria-label={p.filterAria}>
                <label className="inline-label grow">
                  {p.searchCategory}
                  <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={p.searchPlaceholder} />
                </label>
                {search.trim() !== "" && (
                  <button type="button" className="secondary" onClick={() => setSearch("")}>
                    {t.common.clearFilters}
                  </button>
                )}
              </div>
              {search.trim() !== "" && (
                <p className="muted note">
                  {p.showing(byCategory.categories.filter((c) => matchesName(c.categoryName, search)).length, byCategory.categories.length)}
                </p>
              )}
              {byCategory.categories.every((c) => !matchesName(c.categoryName, search)) && (
                <p className="status">
                  {p.noMatch(search.trim())}{" "}
                  <button className="secondary" onClick={() => setSearch("")}>
                    {t.common.clearFilters}
                  </button>
                </p>
              )}
            <table>
              <caption className="sr-only">{p.categoryCaption}</caption>
              <thead>
                <tr>
                  <SortableTh label={t.common.category} column="category" sort={sort} firstDir={CATEGORY_FIRST_DIR.category} onSort={setSort} />
                  <SortableTh label={p.spent} column="spent" sort={sort} firstDir={CATEGORY_FIRST_DIR.spent} onSort={setSort} className="num" />
                  <SortableTh label={p.share} column="share" sort={sort} firstDir={CATEGORY_FIRST_DIR.share} onSort={setSort} />
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
                      <td className="num">{formatCents(c.spentCents, lang)}</td>
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
                  <th>{t.common.total}</th>
                  <th className="num">{formatCents(byCategory.totalSpentCents, lang)}</th>
                  <th />
                </tr>
              </tfoot>
            </table>
            </>
          )}
          <p className="muted note">{p.expensesNote}</p>

          <h2>{p.byMonthTitle}</h2>
          <table>
            <caption className="sr-only">{p.byMonthCaption}</caption>
            <thead>
              <tr>
                <SortableTh label={t.common.month} column="month" sort={monthSort} firstDir={MONTH_FIRST_DIR.month} onSort={setMonthSort} />
                <SortableTh label={t.common.income} column="income" sort={monthSort} firstDir={MONTH_FIRST_DIR.income} onSort={setMonthSort} />
                <SortableTh label={t.common.expenses} column="expenses" sort={monthSort} firstDir={MONTH_FIRST_DIR.expenses} onSort={setMonthSort} />
                <SortableTh label={t.common.netCashFlow} column="net" sort={monthSort} firstDir={MONTH_FIRST_DIR.net} onSort={setMonthSort} className="num" />
              </tr>
            </thead>
            <tbody>
              {sortMonthRows(overTime.months, monthSort).map((m) => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month, lang)}</td>
                  <td>
                    <span className="income-text">{formatCents(m.incomeCents, lang)}</span>
                    <span className="cell-bar" aria-hidden="true">
                      <span className="fill income" style={{ width: `${percentUsed(m.incomeCents, maxMonthly)}%` }} />
                    </span>
                  </td>
                  <td>
                    <span className="expense-text">{formatCents(m.expensesCents, lang)}</span>
                    <span className="cell-bar" aria-hidden="true">
                      <span className="fill spend" style={{ width: `${percentUsed(m.expensesCents, maxMonthly)}%` }} />
                    </span>
                  </td>
                  <td className={`num ${m.netCashFlowCents < 0 ? "expense-text" : m.netCashFlowCents > 0 ? "income-text" : ""}`}>
                    {formatSignedCents(m.netCashFlowCents, lang)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>{t.common.total}</th>
                <th>{formatCents(overTime.totals.incomeCents, lang)}</th>
                <th>{formatCents(overTime.totals.expensesCents, lang)}</th>
                <th className="num">{formatSignedCents(overTime.totals.netCashFlowCents, lang)}</th>
              </tr>
            </tfoot>
          </table>
          <p className="muted note">{p.netNote}</p>
        </>
      )}
    </main>
  );
}
