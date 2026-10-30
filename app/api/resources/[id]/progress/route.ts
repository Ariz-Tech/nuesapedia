import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserReadingProgress, upsertReadingProgress } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/resources/:id/progress
 * Retrieve reading progress for the current user (docs/API_SPEC.md §48)
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required to read synced progress.",
          },
        },
        { status: 401 }
      );
    }

    const { id } = await params;
    const progress = await getUserReadingProgress(session.userId, id);

    return NextResponse.json({
      success: true,
      data: progress || {
        userId: session.userId,
        resourceId: id,
        percentage: 0,
        page: 1,
        updatedAt: null,
      },
    });
  } catch (error) {
    console.error("GET /api/resources/[id]/progress error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve reading progress.",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/resources/:id/progress
 * Update reading progress for the current user (docs/API_SPEC.md §48)
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required to sync reading progress.",
          },
        },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const percentage = Number(body.percentage ?? 0);
    const page = Number(body.page ?? 1);

    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "percentage must be a number between 0 and 100.",
          },
        },
        { status: 400 }
      );
    }

    const updated = await upsertReadingProgress(session.userId, id, percentage, page);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("PUT /api/resources/[id]/progress error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update reading progress.",
        },
      },
      { status: 500 }
    );
  }
}
