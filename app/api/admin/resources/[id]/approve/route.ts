import { NextResponse } from "next/server";
import { getSession, hasModeratorAccess } from "@/lib/auth";
import { initDb, updateSubmissionStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/resources/:id/approve
 * Approves a pending submission and publishes it to the catalog (docs/API_SPEC.md §48)
 */
export async function POST(_request: Request, { params }: RouteParams) {
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

    const { id } = await params;
    await initDb();

    const reviewerTag = `${session.name || "Faculty Moderator"} (${session.role})`;
    const updated = await updateSubmissionStatus(id, "APPROVED", {
      reviewedBy: reviewerTag,
    });

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: `No submission found with ID '${id}'.`,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("POST /api/admin/resources/[id]/approve error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to approve submission.",
        },
      },
      { status: 500 }
    );
  }
}

