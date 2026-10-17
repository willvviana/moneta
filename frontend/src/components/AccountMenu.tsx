import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  COLOR_ROLES,
  DEFAULT_COLORS,
  FONT_CHOICES,
  FONT_ROLES,
  resetColors,
  rgbLabel,
  setColor,
  setFont,
  setMode,
  useTheme,
  type FontChoice,
} from "../theme";
import { useI18n } from "../i18n/locale";
import { LanguageSelect } from "./LanguageSelect";

// A profile icon that opens a small panel with the signed-in email, appearance settings and Log out.
// A disclosure pattern: a button with aria-expanded controlling a panel. It closes on an outside
// click, on Escape (focus returns to the button) and after navigating.
export function AccountMenu({ email, onLogout }: { email: string; onLogout(): void }) {
  const [open, setOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const theme = useTheme();
  const { t } = useI18n();
  const a = t.account;
  const overrides = theme.overrides[theme.mode];

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="account" ref={rootRef}>
      <button
        ref={buttonRef}
        className="secondary account-button"
        aria-label={a.menuAria}
        aria-expanded={open}
        aria-controls="account-panel"
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="8.5" r="3.6" />
          <path d="M4.8 20c.9-3.6 3.8-5.4 7.2-5.4s6.3 1.8 7.2 5.4" />
        </svg>
      </button>
      {open && (
        <div id="account-panel" className="account-panel">
          <div>
            <p className="account-label">{a.signedInAs}</p>
            <p className="account-email">{email}</p>
          </div>
          <div className="account-rule" aria-hidden="true" />
          <button
            className="secondary"
            aria-expanded={optionsOpen}
            aria-controls="account-options"
            onClick={() => setOptionsOpen((o) => !o)}
          >
            {optionsOpen ? a.hideOptions : a.options}
          </button>
          {optionsOpen && (
            <div id="account-options" className="account-options">
              <div className="account-section">
                <LanguageSelect className="font-row" />
              </div>
              <div className="account-section">
                <p className="account-label">{a.appearance}</p>
                <button className="secondary" onClick={() => setMode(theme.mode === "dark" ? "light" : "dark")}>
                  {a.switchMode(theme.mode !== "dark")}
                </button>
              </div>
              <div className="account-section">
                <p className="account-label">{a.colorsHeading(theme.mode === "dark")}</p>
                {COLOR_ROLES.map(({ role }) => {
                  const value = overrides[role] ?? DEFAULT_COLORS[theme.mode][role];
                  return (
                    <label key={role} className="color-row">
                      <span>{a.colorRoles[role]}</span>
                      <small>{rgbLabel(value)}</small>
                      <input type="color" value={value} onChange={(e) => setColor(role, e.target.value)} />
                    </label>
                  );
                })}
                <button className="secondary" onClick={resetColors} disabled={Object.keys(overrides).length === 0}>
                  {a.resetColors}
                </button>
              </div>
              <div className="account-section">
                <p className="account-label">{a.fonts}</p>
                {FONT_ROLES.map(({ role, fallback }) => (
                  <label key={role} className="font-row">
                    <span>{a.fontRoles[role]}</span>
                    <select value={theme.fonts[role]} onChange={(e) => setFont(role, e.target.value as FontChoice)}>
                      {FONT_CHOICES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                          {c.id === fallback ? a.defaultSuffix : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="account-rule" aria-hidden="true" />
          <button className="secondary account-logout" onClick={onLogout}>
            {a.logout}
          </button>
        </div>
      )}
    </div>
  );
}
