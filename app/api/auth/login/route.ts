import { NextResponse } from "next/server";
import { findUserByEmail, initDb } from "@/lib/db";
import { verifyPassword, createSessionToken, COOKIE_NAME } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // 1. Rate limiting check (Max 10 login attempts per minute per IP)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`login_${clientIp}`, {
      intervalMs: 60000,
      maxRequests: 10,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many login attempts. Please wait ${Math.ceil(
            rateLimit.resetMs / 1000
          )} seconds before trying again.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(rateLimit.resetMs / 1000).toString(),
          },
        }
      );
    }

    await initDb();
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // 2. Strict password verification (Never allow empty or unverified passwords)
    if (!user.password || !verifyPassword(password, user.password)) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // 3. Create secure session token
    const token = createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        level: user.level,
        avatar: user.avatar,
        role: user.role,
      },
    });

    // 4. Set HTTP-only cookie with production security flags
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred during login." },
      { status: 500 }
    );
  }
}
