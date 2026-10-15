import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { yearMonth } from "../months.js";
import * as dashboard from "../services/dashboard.js";
import { parseInput } from "../validation.js";

const querySchema = z.object({ month: yearMonth });

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/", async (req, res) => {
  const { month } = parseInput(querySchema, req.query);
  res.json({ dashboard: await dashboard.get(req.user!.id, month) });
});
