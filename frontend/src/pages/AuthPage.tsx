import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api";
import { useAuth } from "../auth";
import { Brand } from "../components/Brand";
import { LanguageSelect } from "../components/LanguageSelect";
import { errorText } from "../i18n/errors";
import { useI18n } from "../i18n/locale";
import { MIN_PASSWORD_LENGTH } from "../passwordPolicy";

// One form for both screens; only the title, endpoint and link text differ.
export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const { lang, t } = useI18n();
  const a = t.auth;
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isLogin = mode === "login";
  // Where the user was heading before being bounced to /login.
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";

  const expired = (location.state as { expired?: boolean } | null)?.expired === true;
  const passwordChanged = (location.state as { passwordChanged?: boolean } | null)?.passwordChanged === true;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await (isLogin ? login(email, password) : register(email, password));
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? errorText(err, lang) : t.common.somethingWrong);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="card auth-card">
      <div className="auth-top">
        <Brand />
        <LanguageSelect className="inline-label auth-lang" />
      </div>
      <h1>{isLogin ? a.loginTitle : a.registerTitle}</h1>
      {expired && <p className="notice">{a.expired}</p>}
      {passwordChanged && <p className="notice" role="status">{a.passwordChanged}</p>}
      <form onSubmit={onSubmit}>
        <label>
          {a.email}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          {a.password}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={isLogin ? undefined : MIN_PASSWORD_LENGTH}
            required
          />
        </label>
        {!isLogin && <small>{a.minLength(MIN_PASSWORD_LENGTH)}</small>}
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? t.common.pleaseWait : isLogin ? a.login : a.createAccount}
        </button>
      </form>
      <p>
        {isLogin ? (
          <>
            {a.noAccount} <Link to="/register">{a.register}</Link> · <Link to="/change-password">{a.changePassword}</Link>
          </>
        ) : (
          <>{a.alreadyRegistered} <Link to="/login">{a.login}</Link></>
        )}
      </p>
    </main>
  );
}
