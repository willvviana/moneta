import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import { pool } from "./db.js";
import { AppError } from "./errors.js";
import { checkOrigin } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";

const app = express();
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

// Central error handler (Express 5 forwards rejected async handlers here).
// Only AppError messages reach the client; everything else is a generic 500.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err); // full detail stays in server logs
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Moneta API listening on :${port}`));
