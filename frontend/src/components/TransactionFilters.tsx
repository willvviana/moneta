import type { TxFilters } from "../filters";
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
  const set = (patch: Partial<TxFilters>) => onChange({ ...filters, ...patch });

  return (
    <>
      <div className="filters" role="search" aria-label="Filter transactions">
        <label className="inline-label">
          Type
          <select value={filters.type} onChange={(e) => set({ type: e.target.value as TxFilters["type"] })}>
            <option value="all">All</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </label>
        <label className="inline-label">
          Category
          <select value={filters.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-label grow">
          Search description
          <input type="search" value={filters.text} onChange={(e) => set({ text: e.target.value })} placeholder="e.g. supermarket" />
        </label>
        <label className="inline-label narrow">
          Min amount
          <input value={filters.min} onChange={(e) => set({ min: e.target.value })} inputMode="decimal" placeholder="0.00" />
        </label>
        <label className="inline-label narrow">
          Max amount
          <input value={filters.max} onChange={(e) => set({ max: e.target.value })} inputMode="decimal" placeholder="0.00" />
        </label>
        {active && (
          <button type="button" className="secondary" onClick={onClear}>
            Clear filters
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
