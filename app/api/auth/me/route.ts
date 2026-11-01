import { getSession } from "@/lib/auth";
import { findUserById, updateUser } from "@/lib/db";
import { isKnownDepartment } from "@/lib/departments";
import { apiError, apiSuccess } from "@/lib/api-helpers";

const VALID_LEVELS = ["100L", "200L", "300L", "400L", "500L"];

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Not authenticated.", 401);
    }

    const user = await findUserById(session.userId);
    if (!user) {
      return apiError("NOT_FOUND", "User not found.", 404);
    }

    return apiSuccess({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        level: user.level,
        avatar: user.avatar,
        role: session.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    return apiError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Not authenticated.", 401);
    }

    const body = await req.json();
    const { name, department, level, avatar } = body ?? {};

    const cleanUpdates: {
      name?: string;
      department?: string;
      level?: string;
      avatar?: string;
    } = {};

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (trimmed.length < 2 || trimmed.length > 100) {
        return apiError(
          "VALIDATION_ERROR",
          "Name must be between 2 and 100 characters.",
          400
        );
      }
      cleanUpdates.name = trimmed;
    }

    if (department !== undefined) {
      if (!isKnownDepartment(department)) {
        return apiError(
          "VALIDATION_ERROR",
          "Invalid engineering department.",
          400
        );
      }
      cleanUpdates.department = department;
    }

    if (level !== undefined) {
      if (!VALID_LEVELS.includes(String(level))) {
        return apiError("VALIDATION_ERROR", "Invalid academic level.", 400);
      }
      cleanUpdates.level = String(level);
    }

    if (avatar !== undefined) {
      if (
        typeof avatar !== "string" ||
        !avatar.startsWith("https://api.dicebear.com/")
      ) {
        return apiError("VALIDATION_ERROR", "Invalid avatar URL.", 400);
      }
      cleanUpdates.avatar = avatar;
    }

    const updated = await updateUser(session.userId, cleanUpdates);
    if (!updated) {
      return apiError("NOT_FOUND", "User not found.", 404);
    }

    return apiSuccess({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        department: updated.department,
        level: updated.level,
        avatar: updated.avatar,
        role: session.role,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return apiError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}

export const PUT = PATCH;

