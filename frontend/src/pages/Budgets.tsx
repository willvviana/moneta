import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { ApiError } from "../api";
import { deleteBudget, listBudgets, setBudget, type Budget } from "../budgets";
import { BudgetForm } from "../components/BudgetForm";
import { MonthPicker } from "../components/MonthPicker";
import { filterBudgets, type BudgetStatus } from "../filters";
import { sortByName, type SortDir } from "../sort";
import { errorText } from "../i18n/errors";
import { useI18n } from "../i18n/locale";
import { describeRemaining, formatCents, percentUsed } from "../money";
import { currentMonth, monthLabel } from "../month";
import { listCategories, type Category } from "../transactions";

type Editor = null | { mode: "new" } | { mode: "edit"; budget: Budget };
type Notice = { kind: "ok" | "error"; text: string } | null;

export function Budgets() {
  const { lang, t } = useI18n();
  const p = t.budgets;
  const [month, setMonth] = useState(currentMonth());
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<unknown>(null); // translated when shown
  const [editor, setEditor] = useState<Editor>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [status, setStatus] = useState<BudgetStatus>("all"); // kept when you change month
  const [nameDir, setNameDir] = useState<SortDir>("asc");
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
      setLoadError(err);
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
    setNotice({ kind: "ok", text: t.common.saved });
    await load(month, false);
  }

  async function confirmDelete(b: Budget) {
    setBusyId(b.id);
    try {
      await deleteBudget(b.id);
      setNotice({ kind: "ok", text: p.removed }); // only after the API confirmed (204)
    } catch (err) {
      setNotice({ kind: "error", text: p.removeFailed(errorText(err, lang)) });
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

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? t.common.unknownCategory;
  const sorted = sortByName(budgets, (b) => categoryName(b.categoryId), nameDir);
  const rows = filterBudgets(sorted, status);

  return (
    <main className="page">
      <PageHeader eyebrow={p.eyebrow} title={p.title} />

      <MonthPicker month={month} onChange={setMonth}>
        {!editor && loadState === "ready" && <button onClick={() => setEditor({ mode: "new" })}>{p.setBudget}</button>}
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

      {loadState === "loading" && <p className="status">{t.common.loading}</p>}
      {loadState === "error" && (
        <div className="status">
          <p className="error">{p.loadFailed(errorText(loadError, lang))}</p>
          <button onClick={() => void load(month, true)}>{t.common.retry}</button>
        </div>
      )}
      {loadState === "ready" && sorted.length === 0 && <p className="status">{p.empty(monthLabel(month, lang))}</p>}
      {loadState === "ready" && sorted.length > 0 && (
        <>
          <div className="filters" role="search" aria-label={p.filterAria}>
            <label className="inline-label">
              {p.status}
              <select value={status} onChange={(e) => setStatus(e.target.value as BudgetStatus)}>
                <option value="all">{p.all}</option>
                <option value="over">{p.over}</option>
                <option value="within">{p.within}</option>
              </select>
            </label>
            <label className="inline-label">
              {p.sortByName}
              <select value={nameDir} onChange={(e) => setNameDir(e.target.value as SortDir)}>
                <option value="asc">{p.aToZ}</option>
                <option value="desc">{p.zToA}</option>
              </select>
            </label>
            {status !== "all" && (
              <button type="button" className="secondary" onClick={() => setStatus("all")}>
                {t.common.clearFilters}
              </button>
            )}
          </div>
          {status !== "all" && (
            <p className="muted note">{p.showing(rows.length, sorted.length, monthLabel(month, lang))}</p>
          )}
        </>
      )}
      {loadState === "ready" && sorted.length > 0 && rows.length === 0 && (
        <p className="status">
          {p.noMatch}{" "}
          <button className="secondary" onClick={() => setStatus("all")}>
            {t.common.clearFilters}
          </button>
        </p>
      )}
      {loadState === "ready" &&
        rows.map((b) => {
          const over = b.remainingCents < 0;
          const pct = percentUsed(b.spentCents, b.limitCents);
          return (
            <section key={b.id} className="budget-row">
              <div className="budget-head">
                <strong>{categoryName(b.categoryId)}</strong>
                <span className={over ? "over-text" : "muted"}>{describeRemaining(b.remainingCents, lang)}</span>
              </div>
              <div
                className="bar"
                role="progressbar"
                aria-label={p.usedAria(categoryName(b.categoryId))}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, pct)}
              >
                <div className={over ? "bar-fill over" : "bar-fill"} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <div className="budget-foot">
                <span className="muted">
                  {p.spentOf(formatCents(b.spentCents, lang), formatCents(b.limitCents, lang))}{" "}
                  <span className={over ? "share over" : "share"}>{pct}%</span>
                </span>
                <span className="actions-inline">
                  {confirmingId === b.id ? (
                    <>
                      <span>{p.removeConfirm}</span>
                      <button className="danger" disabled={busyId === b.id} onClick={() => void confirmDelete(b)}>
                        {busyId === b.id ? p.removing : t.common.yes}
                      </button>
                      <button className="secondary" disabled={busyId === b.id} onClick={() => setConfirmingId(null)}>
                        {t.common.no}
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="secondary" onClick={() => setEditor({ mode: "edit", budget: b })}>
                        {p.changeLimit}
                      </button>
                      <button className="secondary" onClick={() => setConfirmingId(b.id)}>
                        {p.remove}
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
