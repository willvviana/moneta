import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { ApiError } from "../api";
import { MonthPicker } from "../components/MonthPicker";
import { SortableTh } from "../components/SortableTh";
import { DEFAULT_TX_SORT, TX_FIRST_DIR, sortTransactions, type SortState, type TxSortKey } from "../sort";
import { TransactionFilters } from "../components/TransactionFilters";
import { TransactionForm } from "../components/TransactionForm";
import { EMPTY_TX_FILTERS, amountRangeProblem, filterTransactions, hasActiveTxFilters, type TxFilters } from "../filters";
import { errorText } from "../i18n/errors";
import { useI18n } from "../i18n/locale";
import { formatCents } from "../money";
import { currentMonth, monthLabel, monthRange, todayISO } from "../month";
import {
  createTransaction,
  deleteTransaction,
  listCategories,
  listTransactions,
  updateTransaction,
  type Category,
  type Transaction,
  type TransactionInput,
} from "../transactions";

type Editor = null | { mode: "new" } | { mode: "edit"; tx: Transaction };
type Notice = { kind: "ok" | "error"; text: string } | null;

export function Transactions() {
  const { lang, t } = useI18n();
  const p = t.transactions;
  const [month, setMonth] = useState(currentMonth());
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<unknown>(null); // translated when shown
  const [editor, setEditor] = useState<Editor>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [filters, setFilters] = useState<TxFilters>(EMPTY_TX_FILTERS); // kept when you change month
  const [sort, setSort] = useState<SortState<TxSortKey>>(DEFAULT_TX_SORT); // kept when you change month
  const latest = useRef(0);

  // Always re-reads from the server, so what's on screen is what the API says is stored.
  const load = useCallback(async (m: string, showSpinner: boolean) => {
    const requestId = ++latest.current;
    if (showSpinner) setLoadState("loading");
    const { from, to } = monthRange(m);
    try {
      const [cats, txs] = await Promise.all([listCategories(), listTransactions(from, to)]);
      if (requestId !== latest.current) return; // a newer request (e.g. another month) superseded this one
      setCategories(cats);
      setTransactions(txs);
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

  async function save(input: TransactionInput) {
    // Throws on API failure; the form catches it, shows the message and stays open.
    if (editor?.mode === "edit") await updateTransaction(editor.tx.id, input);
    else await createTransaction(input);

    const { from, to } = monthRange(month);
    const inRange = input.date >= from && input.date < to; // same half-open rule as the backend
    setEditor(null);
    setNotice({
      kind: "ok",
      text: inRange ? t.common.saved : p.savedOutside(input.date, monthLabel(month, lang)),
    });
    await load(month, false);
  }

  async function confirmDelete(tx: Transaction) {
    setBusyId(tx.id);
    try {
      await deleteTransaction(tx.id);
      setNotice({ kind: "ok", text: p.deleted }); // only after the API confirmed (204)
    } catch (err) {
      setNotice({ kind: "error", text: p.deleteFailed(errorText(err, lang)) });
      // 404 = it's already gone (or never ours). Refresh so the list stops showing it.
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
  const defaultDate = todayISO().startsWith(month) ? todayISO() : `${month}-01`;

  // A selected category that no longer exists (e.g. deleted in another tab) is ignored, not "no matches".
  const effective: TxFilters =
    filters.categoryId && !categories.some((c) => c.id === filters.categoryId) ? { ...filters, categoryId: "" } : filters;
  const filtersActive = hasActiveTxFilters(effective);
  // Filter first, then sort what is left.
  const visible = sortTransactions(filterTransactions(transactions, effective), sort, categoryName);

  return (
    <main className="page">
      <PageHeader eyebrow={p.eyebrow} title={p.title} />

      <MonthPicker month={month} onChange={setMonth}>
        {!editor && loadState === "ready" && <button onClick={() => setEditor({ mode: "new" })}>{p.add}</button>}
      </MonthPicker>

      {notice && (
        <p role={notice.kind === "error" ? "alert" : "status"} className={notice.kind === "error" ? "error" : "notice"}>
          {notice.text}
        </p>
      )}

      {editor && (
        <TransactionForm
          key={editor.mode === "edit" ? editor.tx.id : "new"}
          categories={categories}
          initial={editor.mode === "edit" ? editor.tx : undefined}
          defaultDate={defaultDate}
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
      {loadState === "ready" && transactions.length === 0 && <p className="status">{p.empty(monthLabel(month, lang))}</p>}
      {loadState === "ready" && transactions.length > 0 && (
        <>
          <TransactionFilters
            filters={effective}
            onChange={setFilters}
            categories={categories}
            problem={amountRangeProblem(effective.min, effective.max, lang)}
            active={filtersActive}
            onClear={() => setFilters(EMPTY_TX_FILTERS)}
          />
          {filtersActive && (
            <p className="muted note">{p.showing(visible.length, transactions.length, monthLabel(month, lang))}</p>
          )}
        </>
      )}
      {loadState === "ready" && transactions.length > 0 && visible.length === 0 && (
        <p className="status">
          {p.noMatch}{" "}
          <button className="secondary" onClick={() => setFilters(EMPTY_TX_FILTERS)}>
            {t.common.clearFilters}
          </button>
        </p>
      )}
      {loadState === "ready" && visible.length > 0 && (
        <table>
          <thead>
            <tr>
              <SortableTh label={p.date} column="date" sort={sort} firstDir={TX_FIRST_DIR.date} onSort={setSort} />
              <SortableTh label={p.description} column="description" sort={sort} firstDir={TX_FIRST_DIR.description} onSort={setSort} />
              <SortableTh label={t.common.category} column="category" sort={sort} firstDir={TX_FIRST_DIR.category} onSort={setSort} />
              <SortableTh label={t.common.type} column="type" sort={sort} firstDir={TX_FIRST_DIR.type} onSort={setSort} />
              <SortableTh label={p.amount} column="amount" sort={sort} firstDir={TX_FIRST_DIR.amount} onSort={setSort} className="num" />
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((tx) => (
              <tr key={tx.id}>
                <td>{tx.date}</td>
                <td>{tx.description || <span className="muted">—</span>}</td>
                <td>{categoryName(tx.categoryId)}</td>
                <td>{tx.type === "income" ? t.common.incomeType : t.common.expenseType}</td>
                <td className={`num ${tx.type}`}>
                  {tx.type === "income" ? "+" : "−"}
                  {formatCents(tx.amountCents, lang)}
                </td>
                <td className="actions">
                  {confirmingId === tx.id ? (
                    <>
                      <span>{t.common.deleteConfirm}</span>
                      <button className="danger" disabled={busyId === tx.id} onClick={() => void confirmDelete(tx)}>
                        {busyId === tx.id ? t.common.deleting : t.common.yes}
                      </button>
                      <button className="secondary" disabled={busyId === tx.id} onClick={() => setConfirmingId(null)}>
                        {t.common.no}
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="secondary" onClick={() => setEditor({ mode: "edit", tx })}>
                        {t.common.edit}
                      </button>
                      <button className="secondary" onClick={() => setConfirmingId(tx.id)}>
                        {t.common.delete}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
