import express from "express";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mountFrontend } from "../src/frontend.js";

// A throwaway "build" on disk and a tiny app: no database needed.
let dir: string;
const app = express();

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "moneta-dist-"));
  mkdirSync(path.join(dir, "assets"));
  writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>Moneta</title><div id=root></div>");
  writeFileSync(path.join(dir, "assets", "app-abc123.js"), "console.log(1)");
  app.get("/api/ping", (_req, res) => void res.json({ pong: true }));
  app.post("/api/things", (_req, res) => void res.status(201).json({ ok: true }));
  mountFrontend(app, dir);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("mountFrontend", () => {
  it("does nothing when there is no build", () => {
    expect(mountFrontend(express(), path.join(dir, "missing"))).toBe(false);
  });

  it("serves index.html at / and revalidates it every time", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>Moneta</title>");
    expect(res.headers["cache-control"]).toBe("no-cache");
  });

  it("hands client-side routes (/budgets, /transactions) to React via index.html", async () => {
    for (const route of ["/budgets", "/transactions", "/reports"]) {
      const res = await request(app).get(route);
      expect(res.status).toBe(200);
      expect(res.text).toContain("<div id=root>");
    }
  });

  it("serves hashed assets with a one-year immutable cache", async () => {
    const res = await request(app).get("/assets/app-abc123.js");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  it("answers a missing file with a real 404, not the HTML page", async () => {
    const res = await request(app).get("/assets/missing.js");
    expect(res.status).toBe(404);
    expect(res.text).not.toContain("<div id=root>");
  });

  it("never swallows API routes", async () => {
    expect((await request(app).get("/api/ping")).body).toEqual({ pong: true });
    expect((await request(app).post("/api/things")).status).toBe(201);
  });
});
