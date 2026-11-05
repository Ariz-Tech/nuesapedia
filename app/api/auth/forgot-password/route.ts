import { findUserByEmail, createPasswordResetToken } from "@/lib/db";
import { generateResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-helpers";

/**
 * POST /api/auth/forgot-password
 * Issues a single-use, 15-minute cryptographic password reset token (stored SHA-256 hashed)
 * and dispatches it via email without leaking account existence.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const ipLimit = await checkRateLimit(`pwd_forgot:ip:${ip}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!ipLimit.allowed) {
      return apiError(
        "RATE_LIMITED",
        `Too many reset requests. Please wait ${ipLimit.retryAfterSeconds} seconds.`,
        429,
        { "Retry-After": String(ipLimit.retryAfterSeconds) }
      );
    }

    const body = await req.json();
    const normalizedEmail = String(body?.email || "")
      .trim()
      .toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      return apiError(
        "VALIDATION_ERROR",
        "Please enter a valid email address.",
        400
      );
    }

    const emailLimit = await checkRateLimit(`pwd_forgot:email:${normalizedEmail}`, {
      limit: 3,
      windowMs: 15 * 60 * 1000,
    });
    if (!emailLimit.allowed) {
      return apiError(
        "RATE_LIMITED",
        `Too many reset requests for this address. Please wait ${emailLimit.retryAfterSeconds} seconds.`,
        429,
        { "Retry-After": String(emailLimit.retryAfterSeconds) }
      );
    }

    // Fail transparently if production email delivery isn't configured yet
    if (process.env.NODE_ENV === "production" && !process.env.RESEND_API_KEY?.trim()) {
      return apiError(
        "EMAIL_UNAVAILABLE",
        "Automated email password reset is not configured yet. Please contact a NUESA Administrator for identity verification.",
        503
      );
    }

    const genericMessage =
      "If an account exists for that email address, a single-use password reset link (valid for 15 minutes) has been sent.";

    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return apiSuccess({ message: genericMessage });
    }

    const { rawToken, tokenHash } = generateResetToken();
    await createPasswordResetToken(user.id, tokenHash, 15);

    // Canonical application origin for reset links - strictly avoid reflecting untrusted incoming Host headers
    const configuredOrigin =
      process.env.APP_URL?.replace(/\/$/, "") ||
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

    const origin =
      configuredOrigin ||
      (process.env.NODE_ENV === "production"
        ? "https://nuesalib.com.ng"
        : "http://localhost:3000");

    const resetUrl = `${origin}/forgot-password?token=${encodeURIComponent(rawToken)}`;

    const delivery = await sendPasswordResetEmail({
      toEmail: user.email,
      userName: user.name,
      resetUrl,
    });

    if (!delivery.delivered) {
      console.error(
        `[auth] Password reset delivery failed for ${user.email}: ${delivery.reason || "unknown error"}`
      );
      // Uniform generic response: never disclose delivery state or account existence
      return apiSuccess({ message: genericMessage });
    }

    return apiSuccess({
      message: genericMessage,
      ...(process.env.NODE_ENV !== "production" && delivery.devResetUrl
        ? { devResetUrl: delivery.devResetUrl }
        : {}),
    });
  } catch (error) {
    console.error("POST /api/auth/forgot-password error:", error);
    return apiError(
      "INTERNAL_ERROR",
      "Unable to process password reset request.",
      500
    );
  }
}

