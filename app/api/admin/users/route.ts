import { getSession } from "@/lib/auth";
import { getAllUsers, updateUserRole } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-helpers";

const VALID_ROLES = ["STUDENT", "MODERATOR", "ADMIN"];

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return apiError("FORBIDDEN", "Admin privileges required.", 403);
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "200", 10) || 200));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

    const users = await getAllUsers({ limit, offset });
    return apiSuccess({ users });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return apiError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return apiError("FORBIDDEN", "Admin privileges required.", 403);
    }

    const body = await req.json();
    const { userId, role } = body ?? {};

    if (!userId || !role || !VALID_ROLES.includes(String(role))) {
      return apiError(
        "VALIDATION_ERROR",
        "Valid userId and role (STUDENT, MODERATOR, ADMIN) are required.",
        400
      );
    }

    if (userId === session.userId && role !== "ADMIN") {
      return apiError(
        "FORBIDDEN",
        "You cannot revoke your own ADMIN privileges.",
        400
      );
    }

    const updated = await updateUserRole(String(userId), String(role));
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
        role: updated.role,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    console.error("PATCH /api/admin/users error:", error);
    return apiError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
