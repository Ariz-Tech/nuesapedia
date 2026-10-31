import { getSession } from "@/lib/auth";
import {
  getSavedResources,
  addSavedResource,
  removeSavedResource,
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
    const { resourceId, title, courseCode, department, type, fileSize } =
      body ?? {};

    if (!resourceId || !title || !courseCode || !department || !type) {
      return apiError("VALIDATION_ERROR", "Missing resource metadata.", 400);
    }

    const item = await addSavedResource({
      userId: session.userId,
      resourceId: String(resourceId),
      title: String(title).slice(0, 255),
      courseCode: String(courseCode).slice(0, 50),
      department: String(department).slice(0, 255),
      type: String(type).slice(0, 100),
      fileSize: fileSize ? String(fileSize).slice(0, 50) : "PDF Document",
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
