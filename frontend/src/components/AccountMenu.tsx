import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { setMode, useTheme } from "../theme";
import { useI18n } from "../i18n/locale";
import { LanguageSelect } from "./LanguageSelect";

// A profile icon that opens a small panel with the signed-in email, language, light/dark mode and Log out.
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
