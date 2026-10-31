import {
  findUserByEmail,
  createUser,
} from "@/lib/db";
import {
  hashPassword,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";
import { getRandomAvatar } from "@/lib/avatars";
import { DEPARTMENTS } from "@/lib/departments";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { apiError, apiSuccess, validatePassword } from "@/lib/api-helpers";

const VALID_LEVELS = ["100L", "200L", "300L", "400L", "500L"];

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rate = await checkRateLimit(`signup:${ip}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!rate.allowed) {
      return apiError(
        "RATE_LIMITED",
        `Too many signup attempts. Please try again in ${rate.retryAfterSeconds} seconds.`,
        429,
        { "Retry-After": String(rate.retryAfterSeconds) }
      );
    }

    const body = await req.json();
    const { name, email, password, department, level, avatar } = body ?? {};

    if (!name || !email || !password || !department || !level) {
      return apiError(
        "VALIDATION_ERROR",
        "All fields (name, email, password, department, level) are required.",
        400
      );
    }

    const trimmedName = String(name).trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return apiError(
        "VALIDATION_ERROR",
        "Name must be between 2 and 100 characters.",
        400
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail) || normalizedEmail.length > 254) {
      return apiError(
        "VALIDATION_ERROR",
        "Please enter a valid email address.",
        400
      );
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return apiError("VALIDATION_ERROR", pwCheck.message!, 400);
    }

    if (!DEPARTMENTS.includes(department as (typeof DEPARTMENTS)[number])) {
      return apiError(
        "VALIDATION_ERROR",
        "Please select a valid engineering department.",
        400
      );
    }

    if (!VALID_LEVELS.includes(String(level))) {
      return apiError(
        "VALIDATION_ERROR",
        "Please select a valid academic level (100L - 500L).",
        400
      );
    }

    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return apiError(
        "EMAIL_EXISTS",
        "An account with this email already exists.",
        409
      );
    }

    const hashedPassword = await hashPassword(String(password));
    const userAvatar =
      typeof avatar === "string" && avatar.startsWith("https://api.dicebear.com/")
        ? avatar
        : getRandomAvatar(trimmedName);

    const newUser = await createUser({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      department,
      level: String(level),
      avatar: userAvatar,
    });

    const token = createSessionToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      sessionVersion: newUser.sessionVersion,
    });

    const response = apiSuccess(
      {
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
      201
    );

    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch (error) {
    console.error("Signup error:", error);
    return apiError(
      "INTERNAL_ERROR",
      "Unable to create account right now. Please try again shortly.",
      500
    );
  }
}
