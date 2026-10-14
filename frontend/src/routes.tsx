import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth";

// UX only: the server independently enforces auth and ownership on every protected endpoint.

function Status({ children }: { children: string }) {
  return <p className="status">{children}</p>;
}

export function ProtectedRoute() {
  const { state } = useAuth();
  const location = useLocation();

  // Do NOT redirect while the session check is in flight, or a logged-in user flashes to /login.
  if (state.status === "loading") return <Status>Loading…</Status>;
  if (state.status === "error") return <Status>{`Something went wrong: ${state.message}`}</Status>;
  if (state.status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location, expired: state.reason === "expired" }} />;
  }
  return <Outlet />;
}

// Login/register pages: send already-logged-in users home.
export function PublicOnlyRoute() {
  const { state } = useAuth();
  if (state.status === "loading") return <Status>Loading…</Status>;
  if (state.status === "authenticated") return <Navigate to="/" replace />;
  return <Outlet />;
}
