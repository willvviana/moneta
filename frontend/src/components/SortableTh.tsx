import { nextSort, type SortDir, type SortState } from "../sort";

interface Props<K extends string> {
  label: string;
  column: K;
  sort: SortState<K>;
  firstDir: SortDir;
  onSort(next: SortState<K>): void;
  className?: string;
}

// A column header that is a real button (keyboard accessible). aria-sort tells screen readers the current order.
export function SortableTh<K extends string>({ label, column, sort, firstDir, onSort, className }: Props<K>) {
  const active = sort.key === column;
  const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th className={className} aria-sort={ariaSort}>
      <button type="button" className={active ? "sort-btn active" : "sort-btn"} onClick={() => onSort(nextSort(sort, column, firstDir))}>
        {label}
        <span className="sort-arrow" aria-hidden="true">
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
