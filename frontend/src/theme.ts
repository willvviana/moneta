import { useSyncExternalStore } from "react";

// Appearance: dark/light mode plus a few colours the user can override.
// Saved in this browser's localStorage only (not on the server), so it is per device.
// Applied by setting `data-theme` and CSS variables on <html>; styles.css does the rest.

export type Mode = "dark" | "light";
export type ColorRole = "title" | "nav" | "income" | "expense" | "label";

// A role can drive several CSS variables (the labels colour also colours the totals rows).
export const COLOR_ROLES: { role: ColorRole; label: string; cssVars: string[] }[] = [
  { role: "title", label: "Titles and nav text", cssVars: ["--title"] },
  { role: "nav", label: "Navigation and share of spending", cssVars: ["--navy"] },
  { role: "income", label: "Income", cssVars: ["--income"] },
  { role: "expense", label: "Expenses", cssVars: ["--scarlet"] },
  { role: "label", label: "Labels, table headers and totals", cssVars: ["--label", "--label-strong"] },
];

// Must match the defaults in styles.css; they are only used to preselect the colour pickers.
export const DEFAULT_COLORS: Record<Mode, Record<ColorRole, string>> = {
  dark: { title: "#e8eaf2", nav: "#5b7fd6", income: "#39ff14", expense: "#ff2e4d", label: "#7f879d" },
  light: { title: "#171b2b", nav: "#2f4fb0", income: "#15803d", expense: "#c4122f", label: "#5f6783" },
};

// Fonts the user can pick. Instrument Serif and Inter are bundled; the rest are system fonts or generic families.
// Arial is the default for both titles and text.
export type FontRole = "display" | "body" | "label";
export type FontChoice = "arial" | "instrument" | "inter" | "jetbrains" | "sans" | "serif" | "times" | "mono";

export const FONT_CHOICES: { id: FontChoice; label: string; stack: string }[] = [
  { id: "arial", label: "Arial", stack: 'Arial, "Helvetica Neue", Helvetica, sans-serif' },
  { id: "instrument", label: "Instrument Serif", stack: '"Instrument Serif", "Iowan Old Style", Georgia, serif' },
  { id: "inter", label: "Inter", stack: '"Inter Variable", system-ui, -apple-system, "Segoe UI", sans-serif' },
  { id: "jetbrains", label: "JetBrains Mono", stack: '"JetBrains Mono Variable", ui-monospace, "SFMono-Regular", Menlo, monospace' },
  { id: "sans", label: "Sans-serif", stack: "sans-serif" },
  { id: "serif", label: "Serif", stack: "serif" },
  { id: "times", label: "Times New Roman", stack: '"Times New Roman", Times, serif' },
  { id: "mono", label: "Monospace", stack: "monospace" },
];

// `fallback` is what styles.css uses when nothing is overridden (shown as "(Default)" in the menu).
export const FONT_ROLES: { role: FontRole; label: string; cssVar: string; fallback: FontChoice }[] = [
  { role: "display", label: "Title font", cssVar: "--font-display", fallback: "arial" },
  { role: "body", label: "Text font", cssVar: "--font-body", fallback: "arial" },
  // Small uppercase labels: page eyebrows, table headers and totals, card labels.
  { role: "label", label: "Label and totals font", cssVar: "--font-mono", fallback: "jetbrains" },
];

// Overrides are kept per mode: a neon green that suits the dark theme would be unreadable on white.
export type ThemeState = {
  mode: Mode;
  overrides: Record<Mode, Partial<Record<ColorRole, string>>>;
  fonts: Record<FontRole, FontChoice>; // same in both modes; equal to the role's fallback means "not overridden"
};

const STORAGE_KEY = "moneta.theme";
const STORAGE_VERSION = 2; // bump when the meaning of a stored value changes
const HEX = /^#[0-9a-f]{6}$/i;

export const INITIAL_STATE: ThemeState = { mode: "dark", overrides: { dark: {}, light: {} }, fonts: { display: "arial", body: "arial", label: "jetbrains" } };

// Never trust stored data: keep only known modes, known roles and well-formed #rrggbb values.
export function parseStored(raw: string | null): ThemeState {
  if (!raw) return INITIAL_STATE;
  try {
    const data = JSON.parse(raw) as { mode?: unknown; overrides?: Record<string, Record<string, unknown>>; fonts?: Record<string, unknown>; version?: unknown };
    const state: ThemeState = {
      mode: data.mode === "light" ? "light" : "dark",
      overrides: { dark: {}, light: {} },
      fonts: { ...INITIAL_STATE.fonts },
    };
    // Fonts saved before version 2 were stored with the old defaults (Instrument Serif / Inter), so they are ignored.
    for (const { role } of FONT_ROLES) {
      const value = data.version === STORAGE_VERSION ? data.fonts?.[role] : undefined;
      if (FONT_CHOICES.some((c) => c.id === value)) state.fonts[role] = value as FontChoice;
    }
    for (const mode of ["dark", "light"] as const) {
      for (const { role } of COLOR_ROLES) {
        const value = data.overrides?.[mode]?.[role];
        if (typeof value === "string" && HEX.test(value)) state.overrides[mode][role] = value.toLowerCase();
      }
    }
    return state;
  } catch {
    return INITIAL_STATE;
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgbLabel = (hex: string) => `rgb(${hexToRgb(hex).join(", ")})`;

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
  const root = document.documentElement;
  root.dataset.theme = s.mode;
  for (const { role, cssVars } of COLOR_ROLES) {
    const value = s.overrides[s.mode][role];
    for (const cssVar of cssVars) {
      if (value) root.style.setProperty(cssVar, value);
      else root.style.removeProperty(cssVar); // fall back to the stylesheet default
    }
  }
  for (const { role, cssVar, fallback } of FONT_ROLES) {
    const choice = s.fonts[role];
    if (choice === fallback) root.style.removeProperty(cssVar);
    else root.style.setProperty(cssVar, FONT_CHOICES.find((c) => c.id === choice)!.stack);
  }
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

export const setMode = (mode: Mode) => update({ ...state, mode });

export function setColor(role: ColorRole, hex: string) {
  if (!HEX.test(hex)) return;
  update({ ...state, overrides: { ...state.overrides, [state.mode]: { ...state.overrides[state.mode], [role]: hex.toLowerCase() } } });
}

export const setFont = (role: FontRole, choice: FontChoice) => update({ ...state, fonts: { ...state.fonts, [role]: choice } });

export const resetColors = () => update({ ...state, overrides: { ...state.overrides, [state.mode]: {} } });

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
