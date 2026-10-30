import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { findUserByEmail, initDb, updateUserPassword } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rate = checkRateLimit(`pwd_reset:${ip}`, {
      intervalMs: 900000,
      maxRequests: 6,
    });
    if (!rate.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many reset attempts. Please wait 15 minutes and try again.",
          },
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { email, department, level, newPassword } = body;

    if (!email?.trim() || !department?.trim() || !level?.trim() || !newPassword) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Email, department, academic level, and new password are required.",
          },
        },
        { status: 400 }
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "New password must be at least 6 characters long.",
          },
        },
        { status: 400 }
      );
    }

    await initDb();
    const user = await findUserByEmail(email.trim());

    if (
      !user ||
      user.department.toLowerCase() !== department.trim().toLowerCase() ||
      user.level.toUpperCase() !== level.trim().toUpperCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VERIFICATION_FAILED",
            message:
              "Could not verify account details. Ensure your email, department, and level match your registered profile.",
          },
        },
        { status: 400 }
      );
    }

    const hashed = await hashPassword(newPassword);
    await updateUserPassword(user.id, hashed);

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You can now sign in with your new password.",
    });
  } catch (error) {
    console.error("POST /api/auth/reset-password error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to reset password." },
      },
      { status: 500 }
    );
  }
}

