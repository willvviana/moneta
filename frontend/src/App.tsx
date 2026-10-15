import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import { AuthPage } from "./pages/AuthPage";
import { Budgets } from "./pages/Budgets";
import { Home } from "./pages/Home";
import { Transactions } from "./pages/Transactions";
import { ProtectedRoute, PublicOnlyRoute } from "./routes";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/budgets" element={<Budgets />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
