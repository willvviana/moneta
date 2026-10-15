import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { AccountMenu } from "./AccountMenu";
import { Brand } from "./Brand";
import { Footer } from "./Footer";
import { NAV_LINKS } from "./navLinks";

// The shell around every signed-in page: one header with navigation, account and logout.
// On small screens the navigation folds behind a Menu button.
export function Layout() {
  const { state, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]); // close the menu after navigating

  const email = state.status === "authenticated" ? state.user.email : "";

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="brand-link" aria-label="Moneta, overview">
            <Brand />
          </Link>
          <button
            className="menu-toggle secondary"
            aria-expanded={open}
            aria-controls="site-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Close" : "Menu"}
          </button>
          <nav id="site-nav" className={open ? "site-nav open" : "site-nav"} aria-label="Main">
            {NAV_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? "active" : undefined)}>
                {l.label}
              </NavLink>
            ))}
            <AccountMenu email={email} onLogout={() => void logout()} />
          </nav>
        </div>
      </header>
      <Outlet />
      <Footer />
    </>
  );
}
