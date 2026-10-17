import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import { errorText } from "./i18n/errors";
import { useI18n } from "./i18n/locale";

// UX only: the server independently enforces auth and ownership on every protected endpoint.

function Status({ children }: { children: string }) {
  return <p className="status">{children}</p>;
}

export function ProtectedRoute() {
  const { state } = useAuth();
  const { lang, t } = useI18n();
  const location = useLocation();

  // Do NOT redirect while the session check is in flight, or a logged-in user flashes to /login.
  if (state.status === "loading") return <Status>{t.common.loading}</Status>;
  if (state.status === "error") return <Status>{t.common.somethingWrongWith(errorText(state.error, lang))}</Status>;
  if (state.status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location, expired: state.reason === "expired" }} />;
  }
  return <Outlet />;
}

// Login/register pages: send already-logged-in users home.
export function PublicOnlyRoute() {
  const { state } = useAuth();
  const { t } = useI18n();
  if (state.status === "loading") return <Status>{t.common.loading}</Status>;
  if (state.status === "authenticated") return <Navigate to="/" replace />;
  return <Outlet />;
}
