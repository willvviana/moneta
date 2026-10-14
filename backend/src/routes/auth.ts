import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { AppError } from "../errors.js";
import { requireAuth, SESSION_COOKIE } from "../middleware/auth.js";
import { SESSION_ABSOLUTE_DAYS, login, logout, register } from "../services/auth.js";

// Route layer: HTTP only. Validate input, call the service, shape the response.

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  // Length over complexity rules. Max protects against huge-input hashing DoS.
  password: z.string().min(12).max(128),
});

function parse(body: unknown) {
  const result = credentials.safeParse(body);
  if (!result.success) throw new AppError(400, "Invalid email or password format (password needs 12+ characters)");
  return result.data;
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, // not readable from JavaScript (limits XSS damage)
    sameSite: "lax", // not sent on cross-site POSTs (CSRF defence)
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_ABSOLUTE_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

// Brute-force protection: 10 attempts / 15 min / IP on login.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const { email, password } = parse(req.body);
  const { user, token } = await register(email, password);
  setSessionCookie(res, token);
  res.status(201).json({ user });
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = parse(req.body);
  const { user, token } = await login(email, password);
  setSessionCookie(res, token);
  res.json({ user });
});

authRouter.post("/logout", async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string") await logout(token);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(204).end();
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
