import { getSession } from "@/lib/auth";
import { getResourceReports, resolveResourceReport } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-helpers";

/**
 * GET /api/moderation/reports
 * Dedicated moderator/admin endpoint to list reported materials with bounded pagination.
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "MODERATOR")) {
      return apiError("FORBIDDEN", "Moderator or Admin access required.", 403);
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ALL";
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "100", 10) || 100));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

    const reports = await getResourceReports(status, { limit, offset });
    return apiSuccess({ reports });
  } catch (error) {
    console.error("GET /api/moderation/reports error:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch reports.", 500);
  }
}

/**
 * PATCH /api/moderation/reports
 * Marks a report as RESOLVED.
 */
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "MODERATOR")) {
      return apiError("FORBIDDEN", "Moderator or Admin access required.", 403);
    }

    const body = await req.json();
    const reportId = body?.reportId;
    if (!reportId || typeof reportId !== "string") {
      return apiError("VALIDATION_ERROR", "reportId is required.", 400);
    }

    const resolved = await resolveResourceReport(reportId);
    if (!resolved) {
      return apiError("NOT_FOUND", "Report not found.", 404);
    }

    return apiSuccess({ resolved: true });
  } catch (error) {
    console.error("PATCH /api/moderation/reports error:", error);
    return apiError("INTERNAL_ERROR", "Failed to resolve report.", 500);
  }
}

