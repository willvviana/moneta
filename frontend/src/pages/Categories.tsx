import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api";
import { deleteCategory, listCategories, renameCategory, type Category } from "../transactions";

type Notice = { kind: "ok" | "error"; text: string } | null;

const messageOf = (err: unknown) => (err instanceof Error ? err.message : "Unknown error");

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const latest = useRef(0);

  const load = useCallback(async (showSpinner: boolean) => {
    const requestId = ++latest.current;
    if (showSpinner) setLoadState("loading");
    try {
      const list = await listCategories();
      if (requestId !== latest.current) return;
      setCategories(list);
      setLoadState("ready");
    } catch (err) {
      if (requestId !== latest.current) return;
      setLoadError(messageOf(err));
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  function startEdit(c: Category) {
    setEditingId(c.id);
    setConfirmingId(null);
    setDraft(c.name);
    setFormError(null);
    setNotice(null);
  }

  async function submit(e: FormEvent, c: Category) {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return setFormError("Enter a name.");
    if (name.length > 50) return setFormError("Names can be at most 50 characters.");
    if (name === c.name) return setEditingId(null); // nothing changed
    // Quick feedback only: the server is the authority (and also refuses duplicates ignoring case).
    if (categories.some((o) => o.id !== c.id && o.name.toLowerCase() === name.toLowerCase())) {
      return setFormError("You already have a category with that name.");
    }

    setSaving(true);
    setFormError(null);
    try {
      await renameCategory(c.id, name);
      setEditingId(null);
      setNotice({ kind: "ok", text: `Renamed "${c.name}" to "${name}".` }); // only after the API confirmed
      await load(false);
    } catch (err) {
      setFormError(messageOf(err)); // e.g. 409 duplicate, 404 if it no longer exists
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(c: Category) {
    setBusyId(c.id);
    let refresh = true;
    try {
      await deleteCategory(c.id);
      setNotice({ kind: "ok", text: `Deleted "${c.name}".` }); // only after the API confirmed (204)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // The database refuses while transactions or budgets still reference it.
        setNotice({
          kind: "error",
          text: `Can't delete "${c.name}": it is still used by transactions or budgets. Move or remove those first.`,
        });
        refresh = false; // nothing changed
      } else {
        setNotice({ kind: "error", text: `Could not delete "${c.name}": ${messageOf(err)}` });
        refresh = err instanceof ApiError && err.status === 404; // already gone: refresh the list
      }
    }
    setConfirmingId(null);
    setBusyId(null);
    if (refresh) await load(false);
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>Categories</h1>
        <nav className="nav">
          <Link to="/">Home</Link>
          <Link to="/transactions">Transactions</Link>
          <Link to="/budgets">Budgets</Link>
        </nav>
      </header>

      {notice && (
        <p role={notice.kind === "error" ? "alert" : "status"} className={notice.kind === "error" ? "error" : "notice"}>
          {notice.text}
        </p>
      )}

      {loadState === "loading" && <p className="status">Loading…</p>}
      {loadState === "error" && (
        <div className="status">
          <p className="error">Couldn't load categories: {loadError}</p>
          <button onClick={() => void load(true)}>Retry</button>
        </div>
      )}
      {loadState === "ready" && categories.length === 0 && (
        <p className="status">
          No categories yet. Create one when you <Link to="/transactions">add a transaction</Link>.
        </p>
      )}
      {loadState === "ready" && categories.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                {editingId === c.id ? (
                  <td colSpan={2}>
                    <form className="inline" onSubmit={(e) => void submit(e, c)}>
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={50}
                        autoFocus
                        aria-label={`New name for ${c.name}`}
                      />
                      <button type="submit" disabled={saving}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button type="button" className="secondary" disabled={saving} onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </form>
                    {formError && (
                      <p role="alert" className="error">
                        {formError}
                      </p>
                    )}
                  </td>
                ) : (
                  <>
                    <td>{c.name}</td>
                    <td className="actions">
                      {confirmingId === c.id ? (
                        <>
                          <span>Delete?</span>
                          <button className="danger" disabled={busyId === c.id} onClick={() => void confirmDelete(c)}>
                            {busyId === c.id ? "Deleting…" : "Yes"}
                          </button>
                          <button className="secondary" disabled={busyId === c.id} onClick={() => setConfirmingId(null)}>
                            No
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="secondary" onClick={() => startEdit(c)}>
                            Rename
                          </button>
                          <button
                            className="secondary"
                            onClick={() => {
                              setConfirmingId(c.id);
                              setNotice(null);
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
