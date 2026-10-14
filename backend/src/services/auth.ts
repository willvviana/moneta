import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { AppError } from "../errors.js";
import { deleteSession, insertSession, touchValidSession } from "../repositories/sessions.js";
import { findUserByEmail, findUserById, insertUser, type PublicUser } from "../repositories/users.js";

// Service layer: business rules for authentication.

export const SESSION_ABSOLUTE_DAYS = 30;
export const SESSION_IDLE_DAYS = 7;

const hashToken = (token: string): Buffer => createHash("sha256").update(token).digest();

// Hash of a throwaway password. Verifying against it when the email is unknown
// makes "no such user" take about as long as "wrong password" (timing side channel).
const dummyHash = argon2.hash("not-a-real-password", { type: argon2.argon2id });

async function startSession(user: PublicUser) {
  const token = randomBytes(32).toString("base64url"); // 256 bits of randomness
  const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_DAYS * 24 * 60 * 60 * 1000);
  await insertSession(user.id, hashToken(token), expiresAt); // DB only ever sees the hash
  return { user, token, expiresAt };
}

export async function register(email: string, password: string) {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  let user: PublicUser;
  try {
    user = await insertUser(email, passwordHash);
  } catch (err) {
    // 23505 = unique_violation (the lower(email) unique index).
    if ((err as { code?: string }).code === "23505") {
      throw new AppError(409, "Could not register with these details");
    }
    throw err;
  }
  return startSession(user);
}

export async function login(email: string, password: string) {
  const found = await findUserByEmail(email);
  const ok = await argon2.verify(found?.password_hash ?? (await dummyHash), password);
  if (!found || !ok) throw new AppError(401, "Invalid email or password"); // same message for both
  return startSession({ id: found.id, email: found.email });
}

export async function logout(token: string): Promise<void> {
  await deleteSession(hashToken(token));
}

// Used by the auth middleware on every protected request.
export async function userFromSessionToken(token: string): Promise<PublicUser | undefined> {
  const userId = await touchValidSession(hashToken(token), SESSION_IDLE_DAYS);
  return userId ? findUserById(userId) : undefined;
}
