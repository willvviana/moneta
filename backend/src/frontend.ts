import express, { type Express } from "express";
import { existsSync } from "node:fs";
import path from "node:path";

// Production serves the built React app from the same Express service as the API, so the browser sees
// ONE origin (needed for the SameSite=Lax session cookie, see docs/DECISIONS.md).
// Returns false (and mounts nothing) when there is no build, e.g. during development, where Vite serves the UI.
export function mountFrontend(app: Express, distDir: string): boolean {
  const indexHtml = path.join(distDir, "index.html");
  if (!existsSync(indexHtml)) return false;

  // Vite names files in /assets after a hash of their content, so a changed file gets a new URL
  // and old ones can be cached for a year. Everything else must be revalidated.
  app.use(
    express.static(distDir, {
      index: false,
      setHeaders(res, file) {
        if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        else res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );

  // SPA fallback: /transactions, /budgets... are routes of the React app, not files. Hand them index.html
  // and let React Router decide. Excluded: non-GET requests, the API, and anything with a file extension
  // (a missing /assets/x.js must be a real 404, not an HTML page that fails to parse as JavaScript).
  app.use((req, res, next) => {
    const isPage = (req.method === "GET" || req.method === "HEAD") && path.extname(req.path) === "";
    if (!isPage || req.path === "/health" || req.path.startsWith("/api/")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexHtml);
  });
  return true;
}
