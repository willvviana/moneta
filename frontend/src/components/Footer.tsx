import { Link } from "react-router-dom";
import { useI18n } from "../i18n/locale";
import { Brand } from "./Brand";
import { NAV_LINKS } from "./navLinks";

// Site footer. Every statement here describes how Moneta actually works; nothing is aspirational.
export function Footer() {
  const { t } = useI18n();
  const f = t.footer;
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Brand />
          <p className="footer-tagline">{f.tagline}</p>
          <p className="footer-text">{f.text}</p>
        </div>

        <nav className="footer-col footer-explore" aria-label={f.navAria}>
          <p className="footer-heading">{f.explore}</p>
          <ul>
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>{t.nav[l.key]}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer-col footer-values">
          <p className="footer-heading">{f.principles}</p>
          <ul className="footer-principles">
            <li>
              <strong>{f.exactStrong}</strong> {f.exact}
            </li>
            <li>
              <strong>{f.privateStrong}</strong> {f.private}
            </li>
            <li>
              <strong>{f.definitionStrong}</strong> {f.definition}
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-base">
        <span>© {new Date().getFullYear()} Moneta</span>
        <span>{f.builtWith}</span>
      </div>
    </footer>
  );
}
