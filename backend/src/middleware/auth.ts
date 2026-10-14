import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors.js";
import { userFromSessionToken } from "../services/auth.js";

export const SESSION_COOKIE = "sid";

// Tell TypeScript that requireAuth adds req.user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

// AUTHENTICATION: who is this? Sets req.user from the session cookie.
// The user id always comes from here, never from the request body or URL.
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  const user = typeof token === "string" ? await userFromSessionToken(token) : undefined;
  if (!user) throw new AppError(401, "Not authenticated");
  req.user = user;
  next();
}

// CSRF defence (with SameSite=Lax): on state-changing requests, if the browser
// sent an Origin header it must be our frontend. Non-browser clients send no
// Origin and can't ride a victim's cookies, so they are allowed.
export function checkOrigin(allowedOrigin: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const safe = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";
    const origin = req.get("origin");
    if (!safe && origin && origin !== allowedOrigin) throw new AppError(403, "Forbidden origin");
    next();
  };
}
