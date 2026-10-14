import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api";
import { useAuth } from "../auth";

// One form for both screens; only the title, endpoint and link text differ.
export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await (isLogin ? login(email, password) : register(email, password));
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="card">
      <h1>{isLogin ? "Log in to Moneta" : "Create your Moneta account"}</h1>
      {expired && <p className="notice">Your session expired. Please log in again.</p>}
      <form onSubmit={onSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={isLogin ? undefined : 12}
            required
          />
        </label>
        {!isLogin && <small>At least 12 characters.</small>}
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Please wait…" : isLogin ? "Log in" : "Create account"}
        </button>
      </form>
      <p>
        {isLogin ? (
          <>No account? <Link to="/register">Register</Link></>
        ) : (
          <>Already registered? <Link to="/login">Log in</Link></>
        )}
      </p>
    </main>
  );
}
