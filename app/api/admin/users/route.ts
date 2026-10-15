import { NextResponse } from "next/server";
import { getSession, hasAdminAccess } from "@/lib/auth";
import { getAllUsers, updateUserRole, initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_ROLES = ["STUDENT", "MODERATOR", "ADMIN"];

/**
 * GET: Retrieve all registered users for Admin Role Management
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    if (!hasAdminAccess(session.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied. Administrator privileges required.",
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    await initDb();
    const users = await getAllUsers();

    return NextResponse.json({
      success: true,
      users,
      currentAdminId: session.userId,
    });
  } catch (error) {
    console.error("Admin get users error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve user directory." },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Update a user's role (STUDENT, MODERATOR, ADMIN)
 * Request body:
 *  - userId: string
 *  - role: "STUDENT" | "MODERATOR" | "ADMIN"
 */
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    if (!hasAdminAccess(session.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied. Administrator privileges required to change roles.",
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    await initDb();

    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json(
        { success: false, error: "User ID and new role are required." },
        { status: 400 }
      );
    }

    const upperRole = role.toUpperCase();
    if (!VALID_ROLES.includes(upperRole)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid role. Allowed roles: ${VALID_ROLES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const updatedUser = await updateUserRole(userId, upperRole);
    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: "Target user not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User ${updatedUser.name} (${updatedUser.email}) role updated to ${upperRole}.`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        department: updatedUser.department,
        level: updatedUser.level,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("Admin update role error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update user role." },
      { status: 500 }
    );
  }
}
