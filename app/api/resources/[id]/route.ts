import { getSession } from "@/lib/auth";
import {
  getResourceById,
  updateSubmission,
  deleteSubmissionWithChecks,
  canAccessSubmission,
} from "@/lib/db";
import { deleteR2Object } from "@/lib/r2";
import { apiError, apiSuccess } from "@/lib/api-helpers";

/**
 * GET /api/resources/:id
 * Public only for APPROVED materials; uploader and moderators/admins can view pending/rejected items.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const resource = await getResourceById(id);

    if (!resource) {
      return apiError("NOT_FOUND", "Resource not found.", 404);
    }

    const session = await getSession();
    if (!canAccessSubmission(resource, session)) {
      return apiError("NOT_FOUND", "Resource not found.", 404);
    }

    return apiSuccess({ resource });
  } catch (error) {
    console.error("GET /api/resources/[id] error:", error);
    return apiError("INTERNAL_ERROR", "Failed to load resource details.", 500);
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }

    const { id } = await context.params;
    const existing = await getResourceById(id);
    if (!existing) {
      return apiError("NOT_FOUND", "Resource not found.", 404);
    }

    const isMod = session.role === "ADMIN" || session.role === "MODERATOR";
    if (!isMod) {
      if (existing.userId !== session.userId) {
        return apiError(
          "FORBIDDEN",
          "You do not have permission to edit this resource.",
          403
        );
      }
      if (existing.status === "APPROVED") {
        return apiError(
          "FORBIDDEN",
          "Approved resources can only be edited by moderators.",
          403
        );
      }
    }

    const body = await req.json();
    const {
      title,
      courseCode,
      department,
      level,
      semester,
      sessionYear,
      type,
      description,
    } = body ?? {};

    const updated = await updateSubmission(id, {
      title: title ? String(title).trim().slice(0, 200) : undefined,
      courseCode: courseCode
        ? String(courseCode).trim().toUpperCase().slice(0, 20)
        : undefined,
      department: department ? String(department) : undefined,
      level: level ? String(level) : undefined,
      semester: semester ? String(semester) : undefined,
      sessionYear: sessionYear ? String(sessionYear).slice(0, 20) : undefined,
      type: type ? String(type) : undefined,
      description:
        description !== undefined ? String(description).slice(0, 1000) : undefined,
    });

    return apiSuccess({ resource: updated });
  } catch (error) {
    console.error("PATCH /api/resources/[id] error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update resource.", 500);
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }

    const { id } = await context.params;
    const result = await deleteSubmissionWithChecks(
      { userId: session.userId, role: session.role },
      id
    );

    if (!result.deleted) {
      if (result.reason === "ALREADY_APPROVED") {
        return apiError(
          "FORBIDDEN",
          "Approved public resources can only be removed by moderators.",
          403
        );
      }
      if (result.reason === "FORBIDDEN") {
        return apiError(
          "FORBIDDEN",
          "You do not have permission to delete this resource.",
          403
        );
      }
      return apiError("NOT_FOUND", "Resource not found.", 404);
    }

    if (result.r2Key) {
      await deleteR2Object(result.r2Key);
    }

    return apiSuccess({ message: "Resource deleted successfully." });
  } catch (error) {
    console.error("DELETE /api/resources/[id] error:", error);
    return apiError("INTERNAL_ERROR", "Failed to delete resource.", 500);
  }
}
