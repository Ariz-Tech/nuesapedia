import { getSession } from "@/lib/auth";
import {
  upsertReadingProgress,
  getUserReadingProgress,
} from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }

    const { id } = await context.params;
    const allProgress = await getUserReadingProgress(session.userId);
    const match = allProgress.find((p) => p.resourceId === id) || null;

    return apiSuccess({
      progress: match || {
        userId: session.userId,
        resourceId: id,
        percentage: 0,
        page: 1,
        updatedAt: null,
      },
    });
  } catch (error) {
    console.error("GET /api/resources/[id]/progress error:", error);
    return apiError("INTERNAL_ERROR", "Failed to load reading progress.", 500);
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }

    const { id } = await context.params;
    const body = await req.json();
    const percentage =
      typeof body?.percentage === "number" ? body.percentage : 0;
    const page = typeof body?.page === "number" ? body.page : 1;

    const progress = await upsertReadingProgress(
      session.userId,
      id,
      percentage,
      page
    );

    return apiSuccess({ progress });
  } catch (error) {
    console.error("PUT /api/resources/[id]/progress error:", error);
    return apiError("INTERNAL_ERROR", "Failed to save reading progress.", 500);
  }
}
