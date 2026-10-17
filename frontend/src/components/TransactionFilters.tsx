import type { TxFilters } from "../filters";
import { useI18n } from "../i18n/locale";
import type { Category } from "../transactions";

interface Props {
  filters: TxFilters;
  onChange(filters: TxFilters): void;
  categories: Category[];
  problem: string | null; // amount-range error, shown under the controls
  active: boolean;
  onClear(): void;
}

// Filter controls for the transactions table. All state lives in the page; this only renders.
export function TransactionFilters({ filters, onChange, categories, problem, active, onClear }: Props) {
  const { t } = useI18n();
  const f = t.txFilters;
  const set = (patch: Partial<TxFilters>) => onChange({ ...filters, ...patch });

  return (
    <>
      <div className="filters" role="search" aria-label={f.aria}>
        <label className="inline-label">
          {t.common.type}
          <select value={filters.type} onChange={(e) => set({ type: e.target.value as TxFilters["type"] })}>
            <option value="all">{f.all}</option>
            <option value="income">{t.common.incomeType}</option>
            <option value="expense">{t.common.expenseType}</option>
          </select>
        </label>
        <label className="inline-label">
          {t.common.category}
          <select value={filters.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
            <option value="">{f.allCategories}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-label grow">
          {f.search}
          <input type="search" value={filters.text} onChange={(e) => set({ text: e.target.value })} placeholder={f.searchPlaceholder} />
        </label>
        <label className="inline-label narrow">
          {f.min}
          <input value={filters.min} onChange={(e) => set({ min: e.target.value })} inputMode="decimal" placeholder={f.amountPlaceholder} />
        </label>
        <label className="inline-label narrow">
          {f.max}
          <input value={filters.max} onChange={(e) => set({ max: e.target.value })} inputMode="decimal" placeholder={f.amountPlaceholder} />
        </label>
        {active && (
          <button type="button" className="secondary" onClick={onClear}>
            {t.common.clearFilters}
          </button>
        )}
      </div>
      {problem && (
        <p role="alert" className="error">
          {problem}
        </p>
      )}
    </>
  );
}
