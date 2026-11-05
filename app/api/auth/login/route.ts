import { findUserByEmail, isConfiguredAdminEmail } from "@/lib/db";
import {
  verifyPassword,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { getReadyDb, isDevMemoryMode, devStore } from "@/lib/db/pool";

// Constant dummy scrypt salt:hash to normalize password hashing execution time
// on non-existent accounts, preventing timing-based account enumeration attacks.
const DUMMY_SCRYPT_HASH =
  "00112233445566778899aabbccddeeff:00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const ipRate = await checkRateLimit(`login:ip:${ip}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!ipRate.allowed) {
      return apiError(
        "RATE_LIMITED",
        `Too many login attempts. Please try again in ${ipRate.retryAfterSeconds} seconds.`,
        429,
        { "Retry-After": String(ipRate.retryAfterSeconds) }
      );
    }

    const body = await req.json();
    const { email, password } = body ?? {};

    if (!email || !password) {
      return apiError(
        "VALIDATION_ERROR",
        "Email and password are required.",
        400
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailRate = await checkRateLimit(`login:email:${normalizedEmail}`, {
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });
    if (!emailRate.allowed) {
      return apiError(
        "RATE_LIMITED",
        `Too many login attempts for this account. Please try again in ${emailRate.retryAfterSeconds} seconds.`,
        429,
        { "Retry-After": String(emailRate.retryAfterSeconds) }
      );
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      // Execute constant-time dummy password verification to neutralize CPU timing differences
      await verifyPassword(String(password), DUMMY_SCRYPT_HASH);
      return apiError("INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }

    const isValid = await verifyPassword(String(password), user.password);
    if (!isValid) {
      return apiError("INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }

    let effectiveRole = user.role;
    if (isConfiguredAdminEmail(user.email) && user.role !== "ADMIN") {
      effectiveRole = "ADMIN";
      if (isDevMemoryMode()) {
        const u = devStore.users.get(normalizedEmail);
        if (u) u.role = "ADMIN";
      } else {
        const db = await getReadyDb();
        await db.query(`UPDATE users SET role = 'ADMIN' WHERE id = $1`, [user.id]);
      }
    }

    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      role: effectiveRole,
      sessionVersion: user.sessionVersion,
    });

    const response = apiSuccess({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        level: user.level,
        avatar: user.avatar,
        role: effectiveRole,
      },
    });

    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return apiError(
      "INTERNAL_ERROR",
      "Unable to sign in right now. Please try again shortly.",
      500
    );
  }
}
