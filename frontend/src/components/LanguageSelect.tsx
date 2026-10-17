import { LANGS, setLang, useI18n, type Lang } from "../i18n/locale";

// Language picker, used in the account menu and on the signed-out pages.
export function LanguageSelect({ className }: { className?: string }) {
  const { lang, t } = useI18n();
  return (
    <label className={className}>
      <span>{t.common.language}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
        {LANGS.map((l) => (
          // lang on each option so screen readers pronounce "Português" as Portuguese
          <option key={l.id} value={l.id} lang={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
