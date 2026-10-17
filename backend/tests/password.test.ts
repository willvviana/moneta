import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/db.js";

// Every email and password is generated at runtime: no credential literal exists in this file.
const createdEmails: string[] = [];
const newPassword = () => randomBytes(18).toString("base64url");

async function registerUser() {
  const agent = request.agent(app);
  const email = `pw-${randomUUID()}@example.test`;
  const password = newPassword();
  const res = await agent.post("/api/auth/register").send({ email, password });
  expect(res.status).toBe(201);
  createdEmails.push(email);
  return { agent, email, password };
}

const change = (body: object) => request(app).post("/api/auth/change-password").send(body);

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE email = ANY($1)`, [createdEmails]);
  await pool.end();
});

// NOTE: the endpoint is rate limited to 10 requests / 15 min / IP, so this file stays under that.
describe("POST /api/auth/change-password", () => {
  it("changes the password: old one stops working, new one works, ALL sessions end", async () => {
    const { agent, email, password } = await registerUser();
    const other = request.agent(app); // a second device, logged in with the same account
    expect((await other.post("/api/auth/login").send({ email, password })).status).toBe(200);
    expect((await agent.get("/api/auth/me")).status).toBe(200);

    const next = newPassword();
    const res = await change({ email, currentPassword: password, newPassword: next });
    expect(res.status).toBe(204);

    // Both previously valid sessions are dead.
    expect((await agent.get("/api/auth/me")).status).toBe(401);
    expect((await other.get("/api/auth/me")).status).toBe(401);
    // Old password rejected, new one accepted.
    expect((await request(app).post("/api/auth/login").send({ email, password })).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email, password: next })).status).toBe(200);
  });

  it("the email is matched ignoring case", async () => {
    const { email, password } = await registerUser();
    const res = await change({ email: email.toUpperCase(), currentPassword: password, newPassword: newPassword() });
    expect(res.status).toBe(204);
  });

  it("a wrong current password is 401 and changes nothing", async () => {
    const { email, password } = await registerUser();
    const res = await change({ email, currentPassword: newPassword(), newPassword: newPassword() });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or current password");
    expect(res.body.code).toBe("INVALID_CURRENT_PASSWORD"); // the client translates by code
    expect((await request(app).post("/api/auth/login").send({ email, password })).status).toBe(200); // still valid
  });

  it("an unknown email gets the SAME 401 message (no account enumeration)", async () => {
    const res = await change({ email: `nobody-${randomUUID()}@example.test`, currentPassword: newPassword(), newPassword: newPassword() });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or current password");
    expect(res.body.code).toBe("INVALID_CURRENT_PASSWORD"); // the client translates by code
  });

  it("rejects a new password equal to the current one", async () => {
    const { email, password } = await registerUser();
    const res = await change({ email, currentPassword: password, newPassword: password });
    expect(res.status).toBe(400);
  });

  it.each([
    ["new password shorter than 8", { newPassword: "1234567" }],
    ["new password longer than 128", { newPassword: "x".repeat(129) }],
    ["missing current password", { currentPassword: undefined }],
    ["unknown extra field", { isAdmin: true }],
  ])("rejects bad input: %s", async (_label, patch) => {
    const { email, password } = await registerUser();
    const res = await change({ email, currentPassword: password, newPassword: newPassword(), ...patch });
    expect(res.status).toBe(400);
    expect((await request(app).post("/api/auth/login").send({ email, password })).status).toBe(200); // unchanged
  });
});
