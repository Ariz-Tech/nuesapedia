import crypto from "node:crypto";
import { cookies } from "next/headers";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL SECURITY CONFIGURATION ERROR: SESSION_SECRET environment variable is missing in production. Please set a strong, high-entropy secret string."
      );
    }
    return "nuesapedia_dev_fallback_secret_key_2026_do_not_use_in_production";
  }
  return secret;
}

export const COOKIE_NAME = "nuesapedia_session";

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
  exp: number;
}

/**
 * Hash a password using scrypt with a unique random salt
 */
export function hashPassword(password: string): string {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a valid non-empty string");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verify a plaintext password against the stored salt:hash string
 */
export function verifyPassword(password: string, storedHash?: string | null): boolean {
  if (!password || !storedHash || typeof password !== "string" || typeof storedHash !== "string") {
    return false;
  }
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Create a signed JWT-like session token
 */
export function createSessionToken(
  user: { id: string; email: string; role: string; name: string },
  expiresInDays = 7
): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp,
  };

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = getSessionSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
}

/**
 * Verify and decode session token
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;

    const secret = getSessionSecret();
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${body}`)
      .digest("base64url");

    if (signature !== expectedSignature) return null;

    const payload: SessionPayload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    );

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Helper to check if role has moderator or admin privileges
 */
export function hasModeratorAccess(role?: string): boolean {
  if (!role) return false;
  const upper = role.toUpperCase();
  return upper === "MODERATOR" || upper === "ADMIN";
}

/**
 * Helper to check if role has full admin privileges
 */
export function hasAdminAccess(role?: string): boolean {
  if (!role) return false;
  return role.toUpperCase() === "ADMIN";
}

/**
 * Helper to get currently logged in session in server components or routes
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = verifySessionToken(token);
  if (!session) return null;

  // Check if user email is declared in ADMIN_EMAILS
  const adminEmails = (process.env.ADMIN_EMAILS || "admin@fuoye.edu.ng")
    .split(",")
    .map((e) => e.trim().toLowerCase());
  if (adminEmails.includes(session.email.toLowerCase())) {
    session.role = "ADMIN";
  }

  return session;
}

