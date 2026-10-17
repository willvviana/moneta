import { useState, type FormEvent } from "react";
import { ApiError } from "../api";
import { errorText } from "../i18n/errors";
import { useI18n } from "../i18n/locale";
import { centsToInput, parseDollarsToCents } from "../money";
import { type Category, type Transaction, type TransactionInput } from "../transactions";
import { CategorySelect } from "./CategorySelect";

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
  const { lang, t } = useI18n();
  const f = t.txForm;
  const [type, setType] = useState<"income" | "expense">(initial?.type ?? "expense");
  const [amount, setAmount] = useState(initial ? centsToInput(initial.amountCents, lang) : "");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountCents = parseDollarsToCents(amount);
    if (amountCents === null) return setError(f.amountInvalid);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError(f.chooseDate);
    if (!categoryId) return setError(t.common.chooseCategory);
    if (description.length > 500) return setError(f.descriptionTooLong);

    setSubmitting(true);
    try {
      await onSubmit({ type, amountCents, date, categoryId, description: description.trim() });
    } catch (err) {
      setError(err instanceof ApiError ? errorText(err, lang) : f.saveFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="tx-form" onSubmit={handleSubmit}>
      <h2>{initial ? f.editTitle : f.addTitle}</h2>
      <div className="grid-2">
        <label>
          {t.common.type}
          <select value={type} onChange={(e) => setType(e.target.value as "income" | "expense")}>
            <option value="expense">{t.common.expenseType}</option>
            <option value="income">{t.common.incomeType}</option>
          </select>
        </label>
        <label>
          {f.amount}
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={f.amountPlaceholder} required />
        </label>
        <label>
          {f.date}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
      </div>
      <CategorySelect
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
        onCategoryCreated={onCategoryCreated}
        onError={setError}
      />
      <label>
        {f.description}
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      </label>
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
