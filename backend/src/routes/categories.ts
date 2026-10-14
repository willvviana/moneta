import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import * as categories from "../services/categories.js";
import { parseId, parseInput } from "../validation.js";

const body = z.object({ name: z.string().trim().min(1).max(50) }).strict();

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth); // every route below needs a valid session

// req.user is set by requireAuth; its id is the ONLY source of userId.
categoriesRouter.get("/", async (req, res) => {
  res.json({ categories: await categories.list(req.user!.id) });
});

categoriesRouter.post("/", async (req, res) => {
  const { name } = parseInput(body, req.body);
  res.status(201).json({ category: await categories.create(req.user!.id, name) });
});

categoriesRouter.patch("/:id", async (req, res) => {
  const { name } = parseInput(body, req.body);
  res.json({ category: await categories.rename(req.user!.id, parseId(req.params.id), name) });
});

categoriesRouter.delete("/:id", async (req, res) => {
  await categories.remove(req.user!.id, parseId(req.params.id));
  res.status(204).end();
});
