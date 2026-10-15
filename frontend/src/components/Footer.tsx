import { Link } from "react-router-dom";
import { Brand } from "./Brand";
import { NAV_LINKS } from "./navLinks";

// Site footer. Every statement here describes how Moneta actually works; nothing is aspirational.
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Brand />
          <p className="footer-tagline">Take control of your money.</p>
          <p className="footer-text">
            Track income and expenses, set monthly budgets, and see where your money goes, with every figure stored and
            calculated in US dollars.
          </p>
        </div>

        <nav className="footer-col footer-explore" aria-label="Footer">
          <p className="footer-heading">Explore</p>
          <ul>
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer-col footer-values">
          <p className="footer-heading">Principles</p>
          <ul className="footer-principles">
            <li>
              <strong>Exact money.</strong> Amounts are stored as whole cents, so totals never drift by a fraction.
            </li>
            <li>
              <strong>Private by design.</strong> Every record belongs to your account, and the server checks that on
              every request.
            </li>
            <li>
              <strong>One definition of spending.</strong> Budgets, the dashboard and reports share the same rules.
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-base">
        <span>© {new Date().getFullYear()} Moneta</span>
        <span>Built with React, Express and PostgreSQL</span>
      </div>
    </footer>
  );
}
