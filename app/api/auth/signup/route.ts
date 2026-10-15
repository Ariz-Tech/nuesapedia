import { NextResponse } from "next/server";
import { createUser, findUserByEmail, initDb } from "@/lib/db";
import { hashPassword, createSessionToken, COOKIE_NAME } from "@/lib/auth";
import { getRandomAvatar } from "@/lib/avatars";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    // 1. Rate limiting check (Max 5 signups per hour per IP)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`signup_${clientIp}`, {
      intervalMs: 3600000,
      maxRequests: 5,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many accounts created from this network. Please try again later.",
        },
        { status: 429 }
      );
    }

    await initDb();
    const body = await request.json();
    const { name, email, password, department, level, avatar } = body;

    if (!name || !email || !password || !department) {
      return NextResponse.json(
        { success: false, error: "Please fill in all required fields (Name, Email, Password, Department)." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanDepartment = department.trim();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    // Password strength check (Minimum 8 chars, at least one letter and one number)
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        {
          success: false,
          error: "Password must be at least 8 characters long and contain both letters and numbers.",
        },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(cleanEmail);
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Assign a random avatar if not specified or roll one
    const assignedAvatar = avatar || getRandomAvatar(cleanName);

    // Hash password securely with scrypt
    const hashedPassword = hashPassword(password);

    // Create user in backend
    const newUser = await createUser({
      name: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      department: cleanDepartment,
      level: level ? level.trim() : "100L",
      avatar: assignedAvatar,
      role: "STUDENT",
    });

    // Create session token
    const token = createSessionToken({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    });

    const response = NextResponse.json(
      {
        success: true,
        message: "Account created successfully",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          department: newUser.department,
          level: newUser.level,
          avatar: newUser.avatar,
          role: newUser.role,
        },
      },
      { status: 201 }
    );

    // Set HTTP-only session cookie
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred during signup." },
      { status: 500 }
    );
  }
}
