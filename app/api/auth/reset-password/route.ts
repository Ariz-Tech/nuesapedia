import { consumePasswordResetToken } from "@/lib/db";
import { hashPassword, hashResetToken } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { apiError, apiSuccess, validatePassword } from "@/lib/api-helpers";

/**
 * POST /api/auth/reset-password
 * Completes password reset using a cryptographic single-use token,
 * revoking all prior sessions by incrementing `session_version`.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit(`pwd_reset:${ip}`, {
      limit: 6,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.allowed) {
      return apiError(
        "RATE_LIMITED",
        `Too many password reset attempts. Please wait ${rl.retryAfterSeconds} seconds.`,
        429,
        { "Retry-After": String(rl.retryAfterSeconds) }
      );
    }

    const body = await req.json();
    const { token, newPassword } = body ?? {};

    if (!token || typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token.trim())) {
      return apiError(
        "INVALID_TOKEN",
        "Invalid or expired password reset link. Please request a new reset email.",
        400
      );
    }

    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      return apiError("VALIDATION_ERROR", pwCheck.message!, 400);
    }

    const tokenHash = hashResetToken(token.trim());
    const hashedPassword = await hashPassword(String(newPassword));
    const updatedUser = await consumePasswordResetToken(tokenHash, hashedPassword);

    if (!updatedUser) {
      return apiError(
        "INVALID_OR_EXPIRED_TOKEN",
        "This password reset link has expired or has already been used. Please request a new one.",
        400
      );
    }

    return apiSuccess({
      message: "Your password has been reset successfully. You may now sign in.",
    });
  } catch (error) {
    console.error("POST /api/auth/reset-password error:", error);
    return apiError("INTERNAL_ERROR", "Unable to reset password.", 500);
  }
}
