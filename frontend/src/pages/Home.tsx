import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { MonthPicker } from "../components/MonthPicker";
import { getDashboard, type Dashboard } from "../dashboard";
import { formatCents, formatSignedCents, percentUsed } from "../money";
import { currentMonth, monthLabel } from "../month";

// The dashboard. Every number comes from the server; this page only formats and lays them out.
export function Home() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<Dashboard | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const latest = useRef(0);

  const load = useCallback(async (m: string) => {
    const requestId = ++latest.current;
    setLoadState("loading");
    try {
      const result = await getDashboard(m);
      if (requestId !== latest.current) return; // superseded by a newer month selection
      setData(result);
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

  const b = data?.budgets;
  const net = data?.netCashFlowCents ?? 0;

  return (
    <main className="page">
      <PageHeader eyebrow="Overview" title="Your month" />

      <MonthPicker month={month} onChange={setMonth} />

      {loadState === "loading" && <p className="status">Loading…</p>}
      {loadState === "error" && (
        <div className="status">
          <p className="error">Couldn't load the dashboard: {loadError}</p>
          <button onClick={() => void load(month)}>Retry</button>
        </div>
      )}

      {loadState === "ready" && data && b && (
        <>
          <section className="cards" aria-label={`Cash flow for ${monthLabel(month)}`}>
            <div className="stat">
              <span className="stat-label">Income</span>
              <span className="stat-value income-text">{formatCents(data.incomeCents)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Expenses</span>
              <span className="stat-value expense-text">{formatCents(data.expensesCents)}</span>
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

          {data.incomeCents === 0 && data.expensesCents === 0 && (
            <p className="status">
              No transactions in {monthLabel(month)}. <Link to="/transactions">Add one</Link>.
            </p>
          )}
        </>
      )}
    </main>
  );
}
