import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { MonthPicker } from "../components/MonthPicker";
import { NetByMonth, SpendingDonut } from "../components/DashboardCharts";
import { buildSlices } from "../charts";
import { getDashboard, type Dashboard } from "../dashboard";
import { formatCents, formatSignedCents, percentUsed } from "../money";
import { currentMonth, monthLabel, shiftMonth } from "../month";
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
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<HomeData | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
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
      setLoadError(err instanceof Error ? err.message : "Unknown error");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void load(month);
  }, [month, load]);

  const d = data?.dashboard;
  const b = d?.budgets;
  const net = d?.netCashFlowCents ?? 0;
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const monthName = new Date(year, monthNumber - 1, 1).toLocaleDateString("en-US", { month: "long" });

  return (
    <main className="page">
      <PageHeader eyebrow="Your money" title={monthName} accent={year} />

      <MonthPicker month={month} onChange={setMonth} />

      {loadState === "loading" && <p className="status">Loading…</p>}
      {loadState === "error" && (
        <div className="status">
          <p className="error">Couldn't load the dashboard: {loadError}</p>
          <button onClick={() => void load(month)}>Retry</button>
        </div>
      )}

      {loadState === "ready" && data && d && b && (
        <>
          <section className="cards" aria-label={`Cash flow for ${monthLabel(month)}`}>
            <div className="stat">
              <span className="stat-label">Income</span>
              <span className="stat-value">{formatCents(d.incomeCents)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Expenses</span>
              <span className="stat-value">{formatCents(d.expensesCents)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Net cash flow</span>
              <span className={`stat-value ${net < 0 ? "expense-text" : net > 0 ? "income-text" : ""}`}>
                {formatSignedCents(net)}
              </span>
            </div>
          </section>
          <p className="muted note">
            Net cash flow is income minus expenses for {monthLabel(month)}. It is not an account balance.
          </p>

          <section className="panel" aria-labelledby="spending-title">
            <div className="panel-head">
              <p className="panel-title" id="spending-title">
                Spending by category
              </p>
              <Link to="/reports" className="panel-meta">
                Reports
              </Link>
            </div>
            {data.byCategory.totalSpentCents === 0 ? (
              <p className="muted">No spending in {monthLabel(month)}.</p>
            ) : (
              <SpendingDonut
                slices={buildSlices(data.byCategory.categories)}
                totalCents={data.byCategory.totalSpentCents}
                caption={`spent in ${monthName}`}
              />
            )}
            {data.byCategory.totalSpentCents > 0 && (
              <p className="muted note">Shares are rounded down, so they can add up to slightly less than 100%.</p>
            )}
          </section>

          <section className="panel" aria-label="Net cash flow by month">
            <NetByMonth months={data.trend} selected={month} onSelect={setMonth} />
          </section>

          <section className="stat wide">
            <div className="budget-head">
              <strong>Budgets</strong>
              <Link to="/budgets">{b.budgetCount === 0 ? "Set a budget" : "Manage"}</Link>
            </div>
            {b.budgetCount === 0 ? (
              <p className="muted">No budgets set for {monthLabel(month)}.</p>
            ) : (
              <>
                <p>
                  {formatCents(b.spentInBudgetedCategoriesCents)} spent of {formatCents(b.totalBudgetedCents)} budgeted{" "}
                  <span className={b.spentInBudgetedCategoriesCents > b.totalBudgetedCents ? "share over" : "share"}>
                    {percentUsed(b.spentInBudgetedCategoriesCents, b.totalBudgetedCents)}%
                  </span>
                </p>
                <p className={b.overBudgetCount > 0 ? "over-text" : "muted"}>
                  {b.overBudgetCount === 0
                    ? "No categories over budget."
                    : `${b.overBudgetCount} ${b.overBudgetCount === 1 ? "category is" : "categories are"} over budget.`}
                </p>
                <p className="muted note">
                  Counts only categories that have a budget, so it can be lower than total expenses above.
                </p>
              </>
            )}
          </section>

          {d.incomeCents === 0 && d.expensesCents === 0 && (
            <p className="status">
              No transactions in {monthLabel(month)}. <Link to="/transactions">Add one</Link>.
            </p>
          )}
        </>
      )}
    </main>
  );
}
