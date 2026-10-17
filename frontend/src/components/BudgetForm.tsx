import { useState, type FormEvent } from "react";
import { ApiError } from "../api";
import type { Budget } from "../budgets";
import { errorText } from "../i18n/errors";
import { useI18n } from "../i18n/locale";
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
  const { lang, t } = useI18n();
  const f = t.budgetForm;
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [limit, setLimit] = useState(initial ? centsToInput(initial.limitCents, lang) : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // PUT is create-or-replace: tell the user when saving will overwrite an existing limit.
  const existing = initial ? undefined : budgets.find((b) => b.categoryId === categoryId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const limitCents = parseDollarsToCents(limit);
    if (limitCents === null) return setError(f.limitInvalid);
    if (!categoryId) return setError(t.common.chooseCategory);

    setSubmitting(true);
    try {
      await onSubmit(categoryId, limitCents);
    } catch (err) {
      setError(err instanceof ApiError ? errorText(err, lang) : f.saveFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="tx-form" onSubmit={handleSubmit}>
      <h2>{initial ? f.changeTitle : f.setTitle}</h2>
      <CategorySelect
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
        onCategoryCreated={onCategoryCreated}
        onError={setError}
        disabled={initial !== undefined}
      />
      <label>
        {f.limit}
        <input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" placeholder={f.limitPlaceholder} required />
      </label>
      {existing && <p className="muted">{f.replaces(formatCents(existing.limitCents, lang))}</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="inline">
        <button type="submit" disabled={submitting}>
          {submitting ? t.common.saving : t.common.save}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={submitting}>
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}
