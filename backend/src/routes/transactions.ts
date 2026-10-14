import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import * as transactions from "../services/transactions.js";
import { idString, isoDate, parseId, parseInput } from "../validation.js";

// Money is integer cents: positive, whole, and within JS's safe integer range.
const base = z.object({
  categoryId: idString,
  type: z.enum(["income", "expense"]),
  amountCents: z.number().int().positive().safe(),
  date: isoDate,
  description: z.string().max(500),
});

// .strict(): unknown keys (e.g. userId) are rejected with 400, never silently ignored.
const createSchema = base.partial({ description: true }).strict();
const patchSchema = base
  .partial()
  .strict()
  .refine((p) => Object.keys(p).length > 0, "at least one field is required");
const rangeSchema = z.object({ from: isoDate, to: isoDate });

export const transactionsRouter = Router();
transactionsRouter.use(requireAuth);

transactionsRouter.get("/", async (req, res) => {
  const { from, to } = parseInput(rangeSchema, req.query);
  res.json({ transactions: await transactions.list(req.user!.id, from, to) });
});

transactionsRouter.post("/", async (req, res) => {
  const input = parseInput(createSchema, req.body);
  res.status(201).json({ transaction: await transactions.create(req.user!.id, input) });
});

transactionsRouter.patch("/:id", async (req, res) => {
  const patch = parseInput(patchSchema, req.body);
  res.json({ transaction: await transactions.update(req.user!.id, parseId(req.params.id), patch) });
});

transactionsRouter.delete("/:id", async (req, res) => {
  await transactions.remove(req.user!.id, parseId(req.params.id));
  res.status(204).end();
});
