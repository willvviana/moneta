import { useState, type KeyboardEvent } from "react";
import { ApiError } from "../api";
import { errorText } from "../i18n/errors";
import { useI18n } from "../i18n/locale";
import { createCategory, type Category } from "../transactions";

interface Props {
  categories: Category[];
  value: string;
  onChange(categoryId: string): void;
  onCategoryCreated(category: Category): void;
  onError(message: string | null): void;
  disabled?: boolean;
}

// A category dropdown plus an inline "new category" box. Used by the transaction and budget forms.
export function CategorySelect({ categories, value, onChange, onCategoryCreated, onError, disabled }: Props) {
  const { lang, t } = useI18n();
  const [newCategory, setNewCategory] = useState("");

  async function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    onError(null);
    // Typing a name that already exists (ignoring case) just selects it. The server stays the
    // authority: if our list was stale, its 409 below is still shown.
    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      onChange(existing.id);
      setNewCategory("");
      return;
    }
    try {
      const created = await createCategory(name);
      onCategoryCreated(created);
      onChange(created.id);
      setNewCategory("");
    } catch (err) {
      onError(err instanceof ApiError ? errorText(err, lang) : t.categorySelect.createFailed);
    }
  }

  // Enter inside the category box adds the category; it must not submit the surrounding form.
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void addCategory();
    }
  }

  return (
    <>
      <label>
        {t.common.category}
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          {categories.length === 0 && <option value="">{t.categorySelect.none}</option>}
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {!disabled && (
        <div className="inline">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={onKey}
            placeholder={t.categorySelect.newPlaceholder}
            maxLength={50}
            aria-label={t.categorySelect.newPlaceholder}
          />
          <button type="button" className="secondary" onClick={() => void addCategory()}>
            {t.categorySelect.add}
          </button>
        </div>
      )}
    </>
  );
}
