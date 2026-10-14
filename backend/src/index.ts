import express from "express";
import { pool } from "./db.js";

const app = express();
app.use(express.json());

// Health check: proves the server is up AND can reach PostgreSQL.
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "up" });
  } catch {
    // Don't leak internal error details to clients.
    res.status(503).json({ status: "error", db: "down" });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Moneta API listening on :${port}`));
