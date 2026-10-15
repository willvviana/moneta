import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { yearMonth } from "../months.js";
import * as budgets from "../services/budgets.js";
import { idString, parseId, parseInput } from "../validation.js";

const querySchema = z.object({ month: yearMonth });
// .strict(): unknown keys (e.g. userId) are rejected with 400.
const putSchema = z
  .object({
    categoryId: idString,
    month: yearMonth,
    limitCents: z.number().int().positive().safe(),
  })
  .strict();

export const budgetsRouter = Router();
budgetsRouter.use(requireAuth);

budgetsRouter.get("/", async (req, res) => {
  const { month } = parseInput(querySchema, req.query);
  res.json({ budgets: await budgets.list(req.user!.id, month) });
});

// PUT = "set the budget for this category and month" (creates or replaces; idempotent).
budgetsRouter.put("/", async (req, res) => {
  const { categoryId, month, limitCents } = parseInput(putSchema, req.body);
  res.json({ budget: await budgets.set(req.user!.id, categoryId, month, limitCents) });
});

budgetsRouter.delete("/:id", async (req, res) => {
  await budgets.remove(req.user!.id, parseId(req.params.id));
  res.status(204).end();
});
