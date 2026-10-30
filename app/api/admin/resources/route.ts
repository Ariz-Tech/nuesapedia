import { NextResponse } from "next/server";
import { getSession, hasModeratorAccess } from "@/lib/auth";
import { getAllSubmissions, initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/resources
 * Admin/Moderator resource queue endpoint per docs/API_SPEC.md §48
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required.",
          },
        },
        { status: 401 }
      );
    }

    if (!hasModeratorAccess(session.role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Moderator or Administrator privileges required.",
          },
        },
        { status: 403 }
      );
    }

    await initDb();
    const { searchParams } = new URL(request.url);
    const rawStatus = (searchParams.get("status") || "PENDING_REVIEW").toUpperCase();
    const normalizedStatus =
      rawStatus === "PENDING" ? "PENDING_REVIEW" : rawStatus;

    const submissions = await getAllSubmissions(normalizedStatus);

    return NextResponse.json({
      success: true,
      data: submissions,
      pagination: {
        page: 1,
        limit: submissions.length || 50,
        totalItems: submissions.length,
        totalPages: 1,
        hasNextPage: false,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/resources error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch admin resources queue.",
        },
      },
      { status: 500 }
    );
  }
}

