import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { pool } from "./db.js";
import { parseAppOrigin, parseTrustProxy } from "./config.js";
import { AppError, safeLogDetails } from "./errors.js";
import { checkOrigin } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { budgetsRouter } from "./routes/budgets.js";
import { categoriesRouter } from "./routes/categories.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { reportsRouter } from "./routes/reports.js";
import { transactionsRouter } from "./routes/transactions.js";

// The app is built here WITHOUT listening, so tests can drive it in-process.
export const app = express();

// In production the API must know exactly which origin may send it state-changing requests.
// Failing at startup beats silently falling back to a localhost default (see config.ts).
const appOrigin = parseAppOrigin(process.env.APP_ORIGIN, process.env.NODE_ENV === "production");

// Behind a reverse proxy (Render, nginx) every request appears to come from the proxy's IP, so the
// rate limiters would share ONE bucket for all users. TRUST_PROXY=<number of proxy hops> (usually 1)
// makes Express read the real client IP from X-Forwarded-For. Leave it unset when not behind a proxy,
// otherwise a client could spoof its IP and dodge the limits.
const hops = parseTrustProxy(process.env.TRUST_PROXY);
if (hops) app.set("trust proxy", hops);

// Security headers: nosniff, frame protection, HSTS, a strict default CSP, and no X-Powered-By.
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(checkOrigin(appOrigin));

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
  console.error("Unhandled error:", safeLogDetails(err)); // detail stays in server logs, minus user data
  res.status(500).json({ error: "Internal server error" });
});
