import { getSession } from "@/lib/auth";
import {
  getSavedResources,
  addSavedResource,
  removeSavedResource,
  getResourceById,
  canAccessSubmission,
} from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Not authenticated.", 401);
    }

    const saved = await getSavedResources(session.userId);
    return apiSuccess({ saved });
  } catch (error) {
    console.error("Get saved resources error:", error);
    return apiError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Not authenticated.", 401);
    }

    const body = await req.json();
    const { resourceId } = body ?? {};

    if (!resourceId || typeof resourceId !== "string") {
      return apiError("VALIDATION_ERROR", "resourceId is required.", 400);
    }

    const cleanResourceId = resourceId.trim();
    const existing = await getResourceById(cleanResourceId);
    if (!existing || !canAccessSubmission(existing, session)) {
      return apiError("NOT_FOUND", "Resource not found or unavailable.", 404);
    }

    const item = await addSavedResource({
      userId: session.userId,
      resourceId: existing.id,
      title: existing.title,
      courseCode: existing.courseCode,
      department: existing.department,
      type: existing.type,
      fileSize: existing.fileSize || "PDF Document",
    });

    return apiSuccess({ saved: item }, 201);
  } catch (error) {
    console.error("Add saved resource error:", error);
    return apiError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Not authenticated.", 401);
    }

    const { searchParams } = new URL(req.url);
    const resourceId = searchParams.get("resourceId");

    if (!resourceId) {
      return apiError("VALIDATION_ERROR", "resourceId is required.", 400);
    }

    await removeSavedResource(session.userId, resourceId);
    return apiSuccess({ removed: true });
  } catch (error) {
    console.error("Remove saved resource error:", error);
    return apiError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
