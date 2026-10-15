import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api";
import { MonthPicker } from "../components/MonthPicker";
import { TransactionForm } from "../components/TransactionForm";
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

const messageOf = (err: unknown) => (err instanceof Error ? err.message : "Unknown error");

export function Transactions() {
  const [month, setMonth] = useState(currentMonth());
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
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

  async function save(input: TransactionInput) {
    // Throws on API failure; the form catches it, shows the message and stays open.
    if (editor?.mode === "edit") await updateTransaction(editor.tx.id, input);
    else await createTransaction(input);

    const { from, to } = monthRange(month);
    const inRange = input.date >= from && input.date < to; // same half-open rule as the backend
    setEditor(null);
    setNotice({
      kind: "ok",
      text: inRange ? "Saved." : `Saved. It is dated ${input.date}, outside ${monthLabel(month)}, so it isn't listed here.`,
    });
    await load(month, false);
  }

  async function confirmDelete(tx: Transaction) {
    setBusyId(tx.id);
    try {
      await deleteTransaction(tx.id);
      setNotice({ kind: "ok", text: "Deleted." }); // only after the API confirmed (204)
    } catch (err) {
      setNotice({ kind: "error", text: `Could not delete: ${messageOf(err)}` });
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

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Unknown";
  const defaultDate = todayISO().startsWith(month) ? todayISO() : `${month}-01`;

  return (
    <main className="page">
      <header className="topbar">
        <h1>Transactions</h1>
        <nav className="nav">
          <Link to="/">Home</Link>
          <Link to="/budgets">Budgets</Link>
          <Link to="/categories">Categories</Link>
        </nav>
      </header>

      <MonthPicker month={month} onChange={setMonth}>
        {!editor && loadState === "ready" && <button onClick={() => setEditor({ mode: "new" })}>Add transaction</button>}
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

      {loadState === "loading" && <p className="status">Loading…</p>}
      {loadState === "error" && (
        <div className="status">
          <p className="error">Couldn't load transactions: {loadError}</p>
          <button onClick={() => void load(month, true)}>Retry</button>
        </div>
      )}
      {loadState === "ready" && transactions.length === 0 && <p className="status">No transactions in {monthLabel(month)}.</p>}
      {loadState === "ready" && transactions.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Type</th>
              <th className="num">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td>{tx.date}</td>
                <td>{tx.description || <span className="muted">—</span>}</td>
                <td>{categoryName(tx.categoryId)}</td>
                <td>{tx.type === "income" ? "Income" : "Expense"}</td>
                <td className={`num ${tx.type}`}>
                  {tx.type === "income" ? "+" : "−"}
                  {formatCents(tx.amountCents)}
                </td>
                <td className="actions">
                  {confirmingId === tx.id ? (
                    <>
                      <span>Delete?</span>
                      <button className="danger" disabled={busyId === tx.id} onClick={() => void confirmDelete(tx)}>
                        {busyId === tx.id ? "Deleting…" : "Yes"}
                      </button>
                      <button className="secondary" disabled={busyId === tx.id} onClick={() => setConfirmingId(null)}>
                        No
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="secondary" onClick={() => setEditor({ mode: "edit", tx })}>
                        Edit
                      </button>
                      <button className="secondary" onClick={() => setConfirmingId(tx.id)}>
                        Delete
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
