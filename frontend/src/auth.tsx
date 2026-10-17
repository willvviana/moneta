import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, setUnauthorizedHandler } from "./api";

export interface User {
  id: string;
  email: string;
}

// Four states, so the UI never guesses: "loading" = still asking the server.
// reason "expired" = we WERE logged in and the server stopped accepting the session.
type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: User }
  | { status: "unauthenticated"; reason?: "expired" }
  | { status: "error"; error: unknown }; // shown with errorText(), in the current language

interface AuthContextValue {
  state: AuthState;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  // On app start, ask the server who we are. The cookie is HTTP-only, so JS can't check it itself.
  useEffect(() => {
    let cancelled = false; // avoid setting state if unmounted (React StrictMode runs effects twice in dev)
    api<{ user: User }>("/auth/me")
      .then(({ user }) => !cancelled && setState({ status: "authenticated", user }))
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) setState({ status: "unauthenticated" });
        else setState({ status: "error", error: err });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Any protected API call that gets a 401 flips us to "expired"; ProtectedRoute then redirects to /login.
  useEffect(() => {
    setUnauthorizedHandler(() =>
      setState((prev) => (prev.status === "authenticated" ? { status: "unauthenticated", reason: "expired" } : prev)),
    );
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api<{ user: User }>("/auth/login", { method: "POST", body: { email, password } });
    setState({ status: "authenticated", user });
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const { user } = await api<{ user: User }>("/auth/register", { method: "POST", body: { email, password } });
    setState({ status: "authenticated", user });
  }, []);

  const logout = useCallback(async () => {
    await api<void>("/auth/logout", { method: "POST" });
    setState({ status: "unauthenticated" });
  }, []);

  const value = useMemo(() => ({ state, login, register, logout }), [state, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
