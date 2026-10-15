import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { monthRangeQuery } from "../months.js";
import * as reports from "../services/reports.js";
import { parseInput } from "../validation.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

// ?from=YYYY-MM&to=YYYY-MM, inclusive, at most 60 months. userId only ever comes from the session.
reportsRouter.get("/spending-by-category", async (req, res) => {
  const { from, to } = parseInput(monthRangeQuery, req.query);
  res.json({ report: await reports.spendingByCategory(req.user!.id, from, to) });
});

reportsRouter.get("/over-time", async (req, res) => {
  const { from, to } = parseInput(monthRangeQuery, req.query);
  res.json({ report: await reports.overTime(req.user!.id, from, to) });
});
