import crypto from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { findUserProfileById } from "./db/users";
import type { DbUser } from "./db/types";

export const SESSION_COOKIE_NAME = "nuesapedia_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Bound concurrent scrypt executions per worker so auth spikes never starve Node's
// libuv threadpool (default 4 threads) and block DNS lookups / FS I/O for other routes.
const MAX_CONCURRENT_SCRYPT = Math.max(
  1,
  Number(process.env.MAX_CONCURRENT_SCRYPT) || 3
);
let activeScryptCount = 0;
const scryptWaitQueue: Array<() => void> = [];

async function runBoundedScrypt(password: string, salt: string): Promise<Buffer> {
  if (activeScryptCount >= MAX_CONCURRENT_SCRYPT) {
    await new Promise<void>((resolve) => {
      scryptWaitQueue.push(resolve);
    });
  }
  activeScryptCount += 1;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, 64, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
  } finally {
    activeScryptCount -= 1;
    const next = scryptWaitQueue.shift();
    if (next) next();
  }
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL SECURITY ERROR: SESSION_SECRET environment variable must be set and at least 32 characters long in production."
      );
    }
    return "nuesapedia-local-dev-fallback-secret-key-minimum-32-chars!!";
  }
  return secret;
}

/**
 * Hashes a plaintext password using scrypt with a unique 16-byte salt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await runBoundedScrypt(password, salt);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Constant-time password verification against `salt:hash`.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (!storedHash || !storedHash.includes(":")) {
    return false;
  }

  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false;

  const keyBuffer = Buffer.from(keyHex, "hex");
  const derivedKey = await runBoundedScrypt(password, salt);

  if (keyBuffer.length !== derivedKey.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  sessionVersion: number;
  exp: number;
}

export function createSessionToken(payload: {
  userId: string;
  email: string;
  role: string;
  sessionVersion?: number;
}): string {
  const exp = Date.now() + SESSION_DURATION_MS;
  const fullPayload: SessionPayload = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    sessionVersion: payload.sessionVersion ?? 1,
    exp,
  };
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [encodedPayload, signature] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", getSessionSecret())
      .update(encodedPayload)
      .digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as SessionPayload;

    if (!payload.exp || Date.now() > payload.exp) return null;
    if (!payload.userId || !payload.email) return null;

    return {
      ...payload,
      sessionVersion: payload.sessionVersion ?? 1,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  };
}

export function generateResetToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export interface SessionWithUser {
  session: SessionPayload;
  user: Omit<DbUser, "password">;
}

/**
 * Resolves the active session cookie AND validates user existence, live RBAC role,
 * and `sessionVersion` against PostgreSQL in a single projection-light query.
 * Wrapped in React `cache()` so both `getSession()` and `getSessionWithUser()`
 * share one database lookup per request / server render pass.
 */
export const getSessionWithUser = cache(async function getSessionWithUser(): Promise<SessionWithUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const verified = verifySessionToken(token);
    if (!verified) return null;

    const user = await findUserProfileById(verified.userId);
    if (!user) return null;

    if (user.sessionVersion !== verified.sessionVersion) {
      return null;
    }

    return {
      session: {
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionVersion: user.sessionVersion,
        exp: verified.exp,
      },
      user,
    };
  } catch {
    return null;
  }
});

export const getSession = cache(async function getSession(): Promise<SessionPayload | null> {
  const resolved = await getSessionWithUser();
  return resolved ? resolved.session : null;
});
