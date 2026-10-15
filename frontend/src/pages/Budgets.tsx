import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api";
import { deleteBudget, listBudgets, setBudget, type Budget } from "../budgets";
import { BudgetForm } from "../components/BudgetForm";
import { MonthPicker } from "../components/MonthPicker";
import { describeRemaining, formatCents, percentUsed } from "../money";
import { currentMonth, monthLabel } from "../month";
import { listCategories, type Category } from "../transactions";

type Editor = null | { mode: "new" } | { mode: "edit"; budget: Budget };
type Notice = { kind: "ok" | "error"; text: string } | null;

const messageOf = (err: unknown) => (err instanceof Error ? err.message : "Unknown error");

export function Budgets() {
  const [month, setMonth] = useState(currentMonth());
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const latest = useRef(0);

  // Always re-reads from the server: spent/remaining are computed there, never on the client.
  const load = useCallback(async (m: string, showSpinner: boolean) => {
    const requestId = ++latest.current;
    if (showSpinner) setLoadState("loading");
    try {
      const [cats, list] = await Promise.all([listCategories(), listBudgets(m)]);
      if (requestId !== latest.current) return; // superseded by a newer request
      setCategories(cats);
      setBudgets(list);
      setLoadState("ready");
    } catch (err) {
      if (requestId !== latest.current) return;
      setLoadError(messageOf(err));
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    setNotice(null);
    setEditor(null);
    setConfirmingId(null);
    void load(month, true);
  }, [month, load]);

  async function save(categoryId: string, limitCents: number) {
    // Throws on API failure; the form shows the message and stays open.
    await setBudget(categoryId, month, limitCents);
    setEditor(null);
    setNotice({ kind: "ok", text: "Saved." });
    await load(month, false);
  }

  async function confirmDelete(b: Budget) {
    setBusyId(b.id);
    try {
      await deleteBudget(b.id);
      setNotice({ kind: "ok", text: "Budget removed." }); // only after the API confirmed (204)
    } catch (err) {
      setNotice({ kind: "error", text: `Could not remove the budget: ${messageOf(err)}` });
      if (!(err instanceof ApiError) || err.status !== 404) {
        setConfirmingId(null);
        setBusyId(null);
        return;
      }
    }
    setConfirmingId(null);
    setBusyId(null);
    await load(month, false);
  }

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Unknown";
  const rows = [...budgets].sort((a, b) => categoryName(a.categoryId).localeCompare(categoryName(b.categoryId)));

  return (
    <main className="page">
      <header className="topbar">
        <h1>Budgets</h1>
        <nav className="nav">
          <Link to="/">Home</Link>
          <Link to="/transactions">Transactions</Link>
        </nav>
      </header>

      <MonthPicker month={month} onChange={setMonth}>
        {!editor && loadState === "ready" && <button onClick={() => setEditor({ mode: "new" })}>Set a budget</button>}
      </MonthPicker>

      {notice && (
        <p role={notice.kind === "error" ? "alert" : "status"} className={notice.kind === "error" ? "error" : "notice"}>
          {notice.text}
        </p>
      )}

      {editor && (
        <BudgetForm
          key={editor.mode === "edit" ? editor.budget.id : "new"}
          categories={categories}
          budgets={budgets}
          initial={editor.mode === "edit" ? editor.budget : undefined}
          onSubmit={save}
          onCancel={() => setEditor(null)}
          onCategoryCreated={(c) => setCategories((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))}
        />
      )}

      {loadState === "loading" && <p className="status">Loading…</p>}
      {loadState === "error" && (
        <div className="status">
          <p className="error">Couldn't load budgets: {loadError}</p>
          <button onClick={() => void load(month, true)}>Retry</button>
        </div>
      )}
      {loadState === "ready" && rows.length === 0 && <p className="status">No budgets for {monthLabel(month)}.</p>}
      {loadState === "ready" &&
        rows.map((b) => {
          const over = b.remainingCents < 0;
          const pct = percentUsed(b.spentCents, b.limitCents);
          return (
            <section key={b.id} className="budget-row">
              <div className="budget-head">
                <strong>{categoryName(b.categoryId)}</strong>
                <span className={over ? "over-text" : "muted"}>{describeRemaining(b.remainingCents)}</span>
              </div>
              <div
                className="bar"
                role="progressbar"
                aria-label={`${categoryName(b.categoryId)} budget used`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, pct)}
              >
                <div className={over ? "bar-fill over" : "bar-fill"} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <div className="budget-foot">
                <span className="muted">
                  {formatCents(b.spentCents)} of {formatCents(b.limitCents)} ({pct}%)
                </span>
                <span className="actions-inline">
                  {confirmingId === b.id ? (
                    <>
                      <span>Remove budget?</span>
                      <button className="danger" disabled={busyId === b.id} onClick={() => void confirmDelete(b)}>
                        {busyId === b.id ? "Removing…" : "Yes"}
                      </button>
                      <button className="secondary" disabled={busyId === b.id} onClick={() => setConfirmingId(null)}>
                        No
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="secondary" onClick={() => setEditor({ mode: "edit", budget: b })}>
                        Change limit
                      </button>
                      <button className="secondary" onClick={() => setConfirmingId(b.id)}>
                        Remove
                      </button>
                    </>
                  )}
                </span>
              </div>
            </section>
          );
        })}
    </main>
  );
}
