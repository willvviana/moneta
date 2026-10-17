import { useSyncExternalStore } from "react";

// Appearance: dark or light mode. Saved in this browser's localStorage only (not on the server),
// so it is per device. Applied by setting `data-theme` on <html>; styles.css does the rest.
//
// Custom colours and fonts were removed (2026-10-16, see docs/DECISIONS.md). Values saved by that
// feature are ignored on load and dropped on the next save, so nobody is stuck with an override
// they can no longer reset.

export type Mode = "dark" | "light";

export type ThemeState = { mode: Mode };

const STORAGE_KEY = "moneta.theme";
const STORAGE_VERSION = 3; // bump when the meaning of a stored value changes

export const INITIAL_STATE: ThemeState = { mode: "light" };

// Never trust stored data: only a known mode from the current version counts.
export function parseStored(raw: string | null): ThemeState {
  if (!raw) return INITIAL_STATE;
  try {
    const data = JSON.parse(raw) as { mode?: unknown; version?: unknown };
    // Before version 3 the mode was always saved (dark by default), so an old value is not a real choice.
    return { mode: data.version === STORAGE_VERSION && data.mode === "dark" ? "dark" : "light" };
  } catch {
    return INITIAL_STATE;
  }
}

// ---- Store (module-level, read in React with useSyncExternalStore) ---------------------------

function load(): ThemeState {
  try {
    return parseStored(localStorage.getItem(STORAGE_KEY));
  } catch {
    return INITIAL_STATE; // storage blocked (private window etc.): still works, just not saved
  }
}

let state = load();
const listeners = new Set<() => void>();

function apply(s: ThemeState) {
  if (typeof document === "undefined") return; // unit tests run without a DOM
  document.documentElement.dataset.theme = s.mode;
}

function update(next: ThemeState) {
  state = next;
  apply(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: STORAGE_VERSION }));
  } catch {
    /* not saved; the change still applies for this visit */
  }
  listeners.forEach((l) => l());
}

export const setMode = (mode: Mode) => update({ mode });

apply(state); // runs when the module is first imported (before React renders), so there is no flash

export function useTheme(): ThemeState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}
