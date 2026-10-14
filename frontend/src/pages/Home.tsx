import { Link } from "react-router-dom";
import { useAuth } from "../auth";

// Placeholder behind the login wall. The dashboard will replace this.
export function Home() {
  const { state, logout } = useAuth();
  if (state.status !== "authenticated") return null; // ProtectedRoute guarantees this; narrows the type

  return (
    <main className="card">
      <h1>Moneta</h1>
      <p>Signed in as {state.user.email}</p>
      <p>
        <Link to="/transactions">Transactions</Link>
      </p>
      <button onClick={() => void logout()}>Log out</button>
    </main>
  );
}
