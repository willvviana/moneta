import { useSyncExternalStore } from "react";
import { MESSAGES, type Messages } from "./messages";

// Interface language. Saved in this browser's localStorage only (like the theme), so it is per device
// and also works on the login page, before anyone is signed in.
// The language also decides the currency LABEL ($ or R$) and number format; the stored amounts are the
// same integer cents either way and are never converted (see docs/DECISIONS.md).

export type Lang = "en-US" | "pt-BR";

// Each option is labelled in its own language, so someone who can't read the current one still finds theirs.
export const LANGS: { id: Lang; label: string }[] = [
  { id: "en-US", label: "English (US)" },
  { id: "pt-BR", label: "Português (Brasil)" },
];

const STORAGE_KEY = "moneta.lang";

export const isLang = (value: unknown): value is Lang => LANGS.some((l) => l.id === value);

// A saved choice wins; otherwise any Portuguese browser language picks pt-BR; everything else is en-US.
// Never trust stored data: an unknown value is ignored.
export function initialLang(stored: string | null, browserLangs: readonly string[]): Lang {
  if (isLang(stored)) return stored;
  return browserLangs.some((l) => l.toLowerCase().startsWith("pt")) ? "pt-BR" : "en-US";
}

// ---- Store (module-level, read in React with useSyncExternalStore) ---------------------------

function load(): Lang {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* storage blocked (private window etc.): fall back to the browser language */
  }
  const browser = typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]);
  return initialLang(stored, browser);
}

let lang: Lang = typeof window === "undefined" ? "en-US" : load(); // unit tests run without a browser
const listeners = new Set<() => void>();

function apply(l: Lang) {
  if (typeof document !== "undefined") document.documentElement.lang = l; // screen readers, hyphenation
}

export function setLang(next: Lang) {
  if (!isLang(next) || next === lang) return;
  lang = next;
  apply(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* not saved; the change still applies for this visit */
  }
  listeners.forEach((l) => l());
}

apply(lang); // before React renders

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => lang,
  );
}

// The current language and its messages. Every component that shows text or amounts calls this,
// so it re-renders when the language changes.
export function useI18n(): { lang: Lang; t: Messages } {
  const l = useLang();
  return { lang: l, t: MESSAGES[l] };
}
