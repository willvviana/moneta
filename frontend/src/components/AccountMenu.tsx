import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

// A profile icon that opens a small panel with the signed-in email and Log out.
// A disclosure pattern: a button with aria-expanded controlling a panel. It closes on an outside
// click, on Escape (focus returns to the button) and after navigating.
export function AccountMenu({ email, onLogout }: { email: string; onLogout(): void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

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
        aria-label="Account menu"
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
            <p className="account-label">Signed in as</p>
            <p className="account-email">{email}</p>
          </div>
          <div className="account-rule" aria-hidden="true" />
          <button className="secondary account-logout" onClick={onLogout}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
