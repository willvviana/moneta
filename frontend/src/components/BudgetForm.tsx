import { useState, type FormEvent } from "react";
import type { Budget } from "../budgets";
import { centsToInput, formatCents, parseDollarsToCents } from "../money";
import type { Category } from "../transactions";
import { CategorySelect } from "./CategorySelect";

interface Props {
  categories: Category[];
  budgets: Budget[]; // this month's budgets, to warn when saving would replace one
  initial?: Budget; // present = changing an existing budget's limit (category locked)
  onSubmit(categoryId: string, limitCents: number): Promise<void>; // throws if the API rejects
  onCancel(): void;
  onCategoryCreated(category: Category): void;
}

export function BudgetForm({ categories, budgets, initial, onSubmit, onCancel, onCategoryCreated }: Props) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [limit, setLimit] = useState(initial ? centsToInput(initial.limitCents) : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // PUT is create-or-replace: tell the user when saving will overwrite an existing limit.
  const existing = initial ? undefined : budgets.find((b) => b.categoryId === categoryId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const limitCents = parseDollarsToCents(limit);
    if (limitCents === null) return setError("Enter a limit greater than 0 with at most 2 decimals, like 500 or 500,00.");
    if (!categoryId) return setError("Choose a category, or create one first.");

    setSubmitting(true);
    try {
      await onSubmit(categoryId, limitCents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the budget.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="tx-form" onSubmit={handleSubmit}>
      <h2>{initial ? "Change budget limit" : "Set a budget"}</h2>
      <CategorySelect
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
        onCategoryCreated={onCategoryCreated}
        onError={setError}
        disabled={initial !== undefined}
      />
      <label>
        Monthly limit (USD)
        <input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" placeholder="500.00" required />
      </label>
      {existing && (
        <p className="muted">
          This category already has a budget this month (limit {formatCents(existing.limitCents)}). Saving replaces it.
        </p>
      )}
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
