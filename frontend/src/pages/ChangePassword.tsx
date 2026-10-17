import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { Brand } from "../components/Brand";
import { LanguageSelect } from "../components/LanguageSelect";
import { errorText } from "../i18n/errors";
import { useI18n } from "../i18n/locale";
import { MIN_PASSWORD_LENGTH } from "../passwordPolicy";

// Reachable while logged out. The server verifies the CURRENT password, so this isn't a "reset":
// it only works for someone who still knows the old password.
export function ChangePassword() {
  const navigate = useNavigate();
  const { lang, t } = useI18n();
  const c = t.changePassword;
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // Quick feedback only: the server validates everything again.
    // The length check is left to minLength on the input.
    if (newPassword !== confirm) return setError(c.mismatch);
    if (newPassword === currentPassword) return setError(c.sameAsCurrent);

    setSubmitting(true);
    try {
      await api<void>("/auth/change-password", { method: "POST", body: { email, currentPassword, newPassword } });
      // Every session was ended on the server, so send them to log in with the new password.
      navigate("/login", { replace: true, state: { passwordChanged: true } });
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
      <h1>{c.title}</h1>
      <form onSubmit={onSubmit}>
        <label>
          {t.auth.email}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          {c.current}
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          {c.new}
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </label>
        <small>{c.hint(MIN_PASSWORD_LENGTH)}</small>
        <label>
          {c.confirm}
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? t.common.pleaseWait : c.submit}
        </button>
      </form>
      <p>
        <Link to="/login">{c.back}</Link>
      </p>
    </main>
  );
}
