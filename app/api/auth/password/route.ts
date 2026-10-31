import {
  getSession,
  verifyPassword,
  hashPassword,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";
import { findUserById, updateUserPassword } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { apiError, apiSuccess, validatePassword } from "@/lib/api-helpers";

export async function PATCH(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit(`pwd_change:${ip}`, {
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.allowed) {
      return apiError(
        "RATE_LIMITED",
        `Too many password change attempts. Try again in ${rl.retryAfterSeconds}s.`,
        429,
        { "Retry-After": String(rl.retryAfterSeconds) }
      );
    }

    const session = await getSession();
    if (!session) {
      return apiError(
        "UNAUTHORIZED",
        "You must be signed in to change your password.",
        401
      );
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body ?? {};

    if (!currentPassword || !newPassword) {
      return apiError(
        "VALIDATION_ERROR",
        "Both current password and new password are required.",
        400
      );
    }

    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      return apiError("VALIDATION_ERROR", pwCheck.message!, 400);
    }

    const user = await findUserById(session.userId);
    if (!user) {
      return apiError("NOT_FOUND", "User account not found.", 404);
    }

    const valid = await verifyPassword(String(currentPassword), user.password);
    if (!valid) {
      return apiError(
        "INVALID_CREDENTIALS",
        "Your current password is incorrect.",
        401
      );
    }

    const hashed = await hashPassword(String(newPassword));
    const updatedUser = await updateUserPassword(user.id, hashed);
    if (!updatedUser) {
      return apiError("INTERNAL_ERROR", "Failed to update password.", 500);
    }

    // Issue a fresh cookie on the current device with the incremented sessionVersion
    // while all other active sessions are immediately invalidated.
    const freshToken = createSessionToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: session.role,
      sessionVersion: updatedUser.sessionVersion,
    });

    const response = apiSuccess({
      message: "Password updated successfully. Other active sessions have been signed out.",
    });
    response.cookies.set(sessionCookieOptions(freshToken));
    return response;
  } catch (error) {
    console.error("PATCH /api/auth/password error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update password.", 500);
  }
}

export const POST = PATCH;

