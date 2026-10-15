import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import { pool } from "./db.js";
import { AppError } from "./errors.js";
import { checkOrigin } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { budgetsRouter } from "./routes/budgets.js";
import { categoriesRouter } from "./routes/categories.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { reportsRouter } from "./routes/reports.js";
import { transactionsRouter } from "./routes/transactions.js";

// The app is built here WITHOUT listening, so tests can drive it in-process.
export const app = express();
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(checkOrigin(process.env.APP_ORIGIN ?? "http://localhost:5173"));

// Health check: proves the server is up AND can reach PostgreSQL.
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "up" });
  } catch {
    res.status(503).json({ status: "error", db: "down" });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/budgets", budgetsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/reports", reportsRouter);

// Central error handler (Express 5 forwards rejected async handlers here).
// Only AppError messages reach the client; everything else is a generic 500.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // body-parser errors (malformed JSON, payload too large) carry a 4xx status.
  const status = (err as { status?: number } | null)?.status;
  if (status === 400 || status === 413) {
    res.status(status).json({ error: "Invalid request body" });
    return;
  }
  console.error(err); // full detail stays in server logs
  res.status(500).json({ error: "Internal server error" });
});
