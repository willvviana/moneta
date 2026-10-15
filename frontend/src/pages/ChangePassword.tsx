import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { Brand } from "../components/Brand";
import { MIN_PASSWORD_LENGTH } from "../passwordPolicy";

// Reachable while logged out. The server verifies the CURRENT password, so this isn't a "reset":
// it only works for someone who still knows the old password.
export function ChangePassword() {
  const navigate = useNavigate();
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
    if (newPassword !== confirm) return setError("The new passwords don't match.");
    if (newPassword === currentPassword) return setError("The new password must be different from the current one.");

    setSubmitting(true);
    try {
      await api<void>("/auth/change-password", { method: "POST", body: { email, currentPassword, newPassword } });
      // Every session was ended on the server, so send them to log in with the new password.
      navigate("/login", { replace: true, state: { passwordChanged: true } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="card auth-card">
      <Brand />
      <h1>Change your password</h1>
      <form onSubmit={onSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </label>
        <small>At least {MIN_PASSWORD_LENGTH} characters. You'll be signed out on all devices.</small>
        <label>
          Confirm new password
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
          {submitting ? "Please wait…" : "Change password"}
        </button>
      </form>
      <p>
        <Link to="/login">Back to log in</Link>
      </p>
    </main>
  );
}
