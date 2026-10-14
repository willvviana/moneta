import { useState, type FormEvent, type KeyboardEvent } from "react";
import { centsToInput, parseDollarsToCents } from "../money";
import { createCategory, type Category, type Transaction, type TransactionInput } from "../transactions";

interface Props {
  categories: Category[];
  initial?: Transaction; // present = edit mode
  defaultDate: string;
  onSubmit(input: TransactionInput): Promise<void>; // throws if the API rejects; the form then stays open
  onCancel(): void;
  onCategoryCreated(category: Category): void;
}

// Client-side validation is for fast feedback only. The server re-validates everything.
export function TransactionForm({ categories, initial, defaultDate, onSubmit, onCancel, onCategoryCreated }: Props) {
  const [type, setType] = useState<"income" | "expense">(initial?.type ?? "expense");
  const [amount, setAmount] = useState(initial ? centsToInput(initial.amountCents) : "");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountCents = parseDollarsToCents(amount);
    if (amountCents === null) return setError("Enter an amount greater than 0 with at most 2 decimals, like 12.34 or 12,34 (no thousands separators).");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Choose a date.");
    if (!categoryId) return setError("Choose a category, or create one first.");
    if (description.length > 500) return setError("Description must be 500 characters or fewer.");

    setSubmitting(true);
    try {
      await onSubmit({ type, amountCents, date, categoryId, description: description.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the transaction.");
    } finally {
      setSubmitting(false);
    }
  }

  async function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    setError(null);
    try {
      const created = await createCategory(name);
      onCategoryCreated(created);
      setCategoryId(created.id);
      setNewCategory("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the category.");
    }
  }

  // Enter inside the category box adds the category; it must not submit the transaction form.
  function onCategoryKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void addCategory();
    }
  }

  return (
    <form className="tx-form" onSubmit={handleSubmit}>
      <h2>{initial ? "Edit transaction" : "Add transaction"}</h2>
      <div className="grid-2">
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value as "income" | "expense")}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>
        <label>
          Amount (USD)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="12.34" required />
        </label>
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Category
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.length === 0 && <option value="">No categories yet</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="inline">
        <input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={onCategoryKey}
          placeholder="New category name"
          maxLength={50}
          aria-label="New category name"
        />
        <button type="button" className="secondary" onClick={() => void addCategory()}>
          Add category
        </button>
      </div>
      <label>
        Description (optional)
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="inline">
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}
