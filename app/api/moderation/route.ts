import { getSession } from "@/lib/auth";
import {
  getAllSubmissions,
  getSubmissionById,
  updateSubmissionStatus,
  findUserById,
} from "@/lib/db";
import { deleteR2Object } from "@/lib/r2";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "MODERATOR" && session.role !== "ADMIN")) {
      return apiError(
        "FORBIDDEN",
        "Moderator or Admin privileges required.",
        403
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ALL";
    const limit = Math.min(300, Math.max(1, parseInt(searchParams.get("limit") || "150", 10) || 150));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

    const submissions = await getAllSubmissions(status, { limit, offset });
    return apiSuccess({ submissions });
  } catch (error) {
    console.error("GET /api/moderation error:", error);
    return apiError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "MODERATOR" && session.role !== "ADMIN")) {
      return apiError(
        "FORBIDDEN",
        "Moderator or Admin privileges required.",
        403
      );
    }

    const body = await req.json();
    const { submissionId, status, rejectionReason } = body ?? {};

    if (!submissionId || (status !== "APPROVED" && status !== "REJECTED")) {
      return apiError(
        "VALIDATION_ERROR",
        "Valid submissionId and status ('APPROVED' or 'REJECTED') are required.",
        400
      );
    }

    if (
      status === "REJECTED" &&
      (!rejectionReason || String(rejectionReason).trim().length < 5)
    ) {
      return apiError(
        "VALIDATION_ERROR",
        "Please provide a clear rejection reason (at least 5 characters) for the contributor.",
        400
      );
    }

    const existing = await getSubmissionById(String(submissionId));
    if (!existing) {
      return apiError("NOT_FOUND", "Submission not found.", 404);
    }

    const reviewer = await findUserById(session.userId);
    const reviewerLabel = reviewer
      ? `${reviewer.name} (${session.role})`
      : session.email;

    const updated = await updateSubmissionStatus(
      String(submissionId),
      status,
      reviewerLabel,
      status === "REJECTED" ? String(rejectionReason).trim().slice(0, 500) : undefined,
      session.userId
    );

    if (!updated) {
      return apiError("NOT_FOUND", "Submission not found.", 404);
    }

    // Retain storage object pointer on rejection for audit, contributor review, or appeal.
    // Permanent purge is mediated by explicit contributor withdrawal or lifecycle rules.
    return apiSuccess({ submission: updated });
  } catch (error) {
    console.error("PATCH /api/moderation error:", error);
    return apiError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
