import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api";
import { PageHeader } from "../components/PageHeader";
import { SortableTh } from "../components/SortableTh";
import { matchesName } from "../filters";
import { DEFAULT_NAME_SORT, sortByName, type NameSortKey, type SortState } from "../sort";
import { createCategory, deleteCategory, listCategories, renameCategory, type Category } from "../transactions";

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
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState<NameSortKey>>(DEFAULT_NAME_SORT);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
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

  function startAdd() {
    setAdding(true);
    setNewName("");
    setAddError(null);
    setNotice(null);
    setEditingId(null);
    setConfirmingId(null);
  }

  async function submitAdd(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return setAddError("Enter a name.");
    if (name.length > 50) return setAddError("Names can be at most 50 characters.");
    // Quick feedback only: the server is the authority (and refuses duplicates ignoring case).
    if (categories.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
      return setAddError("You already have a category with that name.");
    }

    setCreating(true);
    setAddError(null);
    try {
      const created = await createCategory(name); // the SERVER assigns the id
      setAdding(false);
      setSearch(""); // make sure the new row isn't hidden by an active search
      setNotice({ kind: "ok", text: `Added "${created.name}".` }); // only after the API confirmed
      await load(false);
    } catch (err) {
      setAddError(messageOf(err)); // e.g. 409 duplicate created in another tab
    } finally {
      setCreating(false);
    }
  }

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

  const visible = sortByName(
    categories.filter((c) => matchesName(c.name, search)),
    (c) => c.name,
    sort.dir,
  );
  const searching = search.trim() !== "";

  return (
    <main className="page">
      <PageHeader eyebrow="Structure" title="Categories" />

      {notice && (
        <p role={notice.kind === "error" ? "alert" : "status"} className={notice.kind === "error" ? "error" : "notice"}>
          {notice.text}
        </p>
      )}

      {loadState === "ready" && !adding && (
        <div className="month-bar">
          <span className="spacer" />
          <button onClick={startAdd}>Add category</button>
        </div>
      )}
      {adding && (
        <form className="inline add-form" onSubmit={(e) => void submitAdd(e)} aria-label="Add category">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={50}
            autoFocus
            placeholder="Category name"
            aria-label="New category name"
          />
          <button type="submit" disabled={creating}>
            {creating ? "Adding…" : "Add"}
          </button>
          <button type="button" className="secondary" disabled={creating} onClick={() => setAdding(false)}>
            Cancel
          </button>
        </form>
      )}
      {adding && addError && (
        <p role="alert" className="error">
          {addError}
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
          No categories yet. Add one above, or create one when you <Link to="/transactions">add a transaction</Link>.
        </p>
      )}
      {loadState === "ready" && categories.length > 0 && (
        <>
          <div className="filters" role="search" aria-label="Filter categories">
            <label className="inline-label grow">
              Search name
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. supermarket" />
            </label>
            {searching && (
              <button type="button" className="secondary" onClick={() => setSearch("")}>
                Clear filters
              </button>
            )}
          </div>
          {searching && (
            <p className="muted note">
              Showing {visible.length} of {categories.length} categories.
            </p>
          )}
        </>
      )}
      {loadState === "ready" && categories.length > 0 && visible.length === 0 && (
        <p className="status">
          No categories match "{search.trim()}".{" "}
          <button className="secondary" onClick={() => setSearch("")}>
            Clear filters
          </button>
        </p>
      )}
      {loadState === "ready" && visible.length > 0 && (
        <table>
          <thead>
            <tr>
              <SortableTh label="Name" column="name" sort={sort} firstDir="asc" onSort={setSort} />
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
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
