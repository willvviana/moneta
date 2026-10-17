import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { MonthPicker } from "../components/MonthPicker";
import { NetByMonth, SpendingDonut } from "../components/DashboardCharts";
import { buildSlices } from "../charts";
import { getDashboard, type Dashboard } from "../dashboard";
import { errorText } from "../i18n/errors";
import { useI18n } from "../i18n/locale";
import { formatCents, formatSignedCents, percentUsed } from "../money";
import { capitalize, currentMonth, monthLabel, monthName as monthNameOf, shiftMonth } from "../month";
import { getOverTime, getSpendingByCategory, type CategoryReport, type MonthRow } from "../reports";

const TREND_MONTHS = 6; // the bar chart shows the selected month and the five before it

interface HomeData {
  dashboard: Dashboard;
  byCategory: CategoryReport; // the selected month only
  trend: MonthRow[];
}

// The dashboard. Every number comes from the server (the dashboard and the two report endpoints, which
// share the same definitions); this page only formats and lays them out.
export function Home() {
  const { lang, t } = useI18n();
  const h = t.home;
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<HomeData | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<unknown>(null);
  const latest = useRef(0);

  const load = useCallback(async (m: string) => {
    const requestId = ++latest.current;
    setLoadState("loading");
    try {
      const [dashboard, byCategory, overTime] = await Promise.all([
        getDashboard(m),
        getSpendingByCategory(m, m),
        getOverTime(shiftMonth(m, -(TREND_MONTHS - 1)), m),
      ]);
      if (requestId !== latest.current) return; // superseded by a newer month selection
      setData({ dashboard, byCategory, trend: overTime.months });
      setLoadState("ready");
    } catch (err) {
      if (requestId !== latest.current) return;
      setLoadError(err);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void load(month);
  }, [month, load]);

  const d = data?.dashboard;
  const b = d?.budgets;
  const net = d?.netCashFlowCents ?? 0;
  const year = month.slice(0, 4);
  const monthName = monthNameOf(month, lang); // lowercase in Portuguese ("outubro"): right mid-sentence
  const label = monthLabel(month, lang);

  return (
    <main className="page">
      <PageHeader eyebrow={h.eyebrow} title={capitalize(monthName)} accent={year} />

      <MonthPicker month={month} onChange={setMonth} />

      {loadState === "loading" && <p className="status">{t.common.loading}</p>}
      {loadState === "error" && (
        <div className="status">
          <p className="error">{h.loadFailed(errorText(loadError, lang))}</p>
          <button onClick={() => void load(month)}>{t.common.retry}</button>
        </div>
      )}

      {loadState === "ready" && data && d && b && (
        <>
          <section className="cards" aria-label={h.cashFlowAria(label)}>
            <div className="stat">
              <span className="stat-label">{t.common.income}</span>
              <span className="stat-value">{formatCents(d.incomeCents, lang)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">{t.common.expenses}</span>
              <span className="stat-value">{formatCents(d.expensesCents, lang)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">{t.common.netCashFlow}</span>
              <span className={`stat-value ${net < 0 ? "expense-text" : net > 0 ? "income-text" : ""}`}>
                {formatSignedCents(net, lang)}
              </span>
            </div>
          </section>
          <p className="muted note">{h.netNote(label)}</p>

          <section className="panel" aria-labelledby="spending-title">
            <div className="panel-head">
              <p className="panel-title" id="spending-title">
                {h.spendingByCategory}
              </p>
              <Link to="/reports" className="panel-meta">
                {h.reportsLink}
              </Link>
            </div>
            {data.byCategory.totalSpentCents === 0 ? (
              <p className="muted">{h.noSpending(label)}</p>
            ) : (
              <SpendingDonut
                slices={buildSlices(data.byCategory.categories, t.charts.other)}
                totalCents={data.byCategory.totalSpentCents}
                caption={h.spentIn(monthName)}
              />
            )}
            {data.byCategory.totalSpentCents > 0 && (
              <p className="muted note">{h.sharesNote}</p>
            )}
          </section>

          <section className="panel" aria-label={t.charts.netByMonth}>
            <NetByMonth months={data.trend} selected={month} onSelect={setMonth} />
          </section>

          <section className="stat wide">
            <div className="budget-head">
              <strong>{h.budgets}</strong>
              <Link to="/budgets">{b.budgetCount === 0 ? h.setBudget : h.manage}</Link>
            </div>
            {b.budgetCount === 0 ? (
              <p className="muted">{h.noBudgets(label)}</p>
            ) : (
              <>
                <p>
                  {h.spentOfBudgeted(formatCents(b.spentInBudgetedCategoriesCents, lang), formatCents(b.totalBudgetedCents, lang))}{" "}
                  <span className={b.spentInBudgetedCategoriesCents > b.totalBudgetedCents ? "share over" : "share"}>
                    {percentUsed(b.spentInBudgetedCategoriesCents, b.totalBudgetedCents)}%
                  </span>
                </p>
                <p className={b.overBudgetCount > 0 ? "over-text" : "muted"}>
                  {b.overBudgetCount === 0 ? h.noneOver : h.over(b.overBudgetCount)}
                </p>
                <p className="muted note">{h.budgetNote}</p>
              </>
            )}
          </section>

          {d.incomeCents === 0 && d.expensesCents === 0 && (
            <p className="status">
              {h.noTransactions(label)} <Link to="/transactions">{h.addOne}</Link>.
            </p>
          )}
        </>
      )}
    </main>
  );
}
