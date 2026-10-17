import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { AppError } from "../errors.js";
import { requireAuth, SESSION_COOKIE } from "../middleware/auth.js";
import { SESSION_ABSOLUTE_DAYS, changePassword, login, logout, register } from "../services/auth.js";

// Route layer: HTTP only. Validate input, call the service, shape the response.

// Minimum length for NEW passwords (registration, change). Lowering it never locks anyone out of login.
export const MIN_PASSWORD_LENGTH = 8;

const email = z.string().trim().toLowerCase().email().max(254);

const credentials = z.object({
  email,
  // Length over complexity rules. Max protects against huge-input hashing DoS.
  password: z.string().min(MIN_PASSWORD_LENGTH).max(128),
});

function parse(body: unknown) {
  const result = credentials.safeParse(body);
  if (!result.success) throw new AppError(400, "INVALID_CREDENTIALS_FORMAT", `Invalid email or password format (password needs ${MIN_PASSWORD_LENGTH}+ characters)`);
  return result.data;
}

const passwordChange = z
  .object({
    email,
    // No minimum on the CURRENT password: we only compare it, we don't set it.
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(128),
  })
  .strict();

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, // not readable from JavaScript (limits XSS damage)
    sameSite: "lax", // not sent on cross-site POSTs (CSRF defence)
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_ABSOLUTE_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

// Brute-force protection: 10 attempts / 15 min / IP. Each limiter has its own counter.
// The 429 body has the same { error, code } shape as every other API error.
const makeAuthLimiter = (limit = 10) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Try again later.", code: "RATE_LIMITED" },
  });
const loginLimiter = makeAuthLimiter();
const changePasswordLimiter = makeAuthLimiter(); // also lets an attacker test password guesses
// Stops one IP from mass-creating accounts (each one costs an argon2 hash). The limit is configurable
// because the test suite legitimately creates many users from one IP.
const registerLimiter = makeAuthLimiter(Number(process.env.REGISTER_RATE_LIMIT) || 10);

export const authRouter = Router();

authRouter.post("/register", registerLimiter, async (req, res) => {
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

authRouter.post("/change-password", changePasswordLimiter, async (req, res) => {
  const parsed = passwordChange.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "INVALID_PASSWORD_CHANGE_FORMAT", `Enter your email, your current password and a new password of ${MIN_PASSWORD_LENGTH}+ characters`);
  await changePassword(parsed.data.email, parsed.data.currentPassword, parsed.data.newPassword);
  res.clearCookie(SESSION_COOKIE, { path: "/" }); // this browser's session was just revoked too
  res.status(204).end();
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
