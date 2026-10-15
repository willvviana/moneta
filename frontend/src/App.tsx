import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import { Layout } from "./components/Layout";
import { AuthPage } from "./pages/AuthPage";
import { Budgets } from "./pages/Budgets";
import { Categories } from "./pages/Categories";
import { Home } from "./pages/Home";
import { Reports } from "./pages/Reports";
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
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/reports" element={<Reports />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
