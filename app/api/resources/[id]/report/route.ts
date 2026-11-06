import { createResourceReport, getResourceById } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-helpers";

/**
 * POST /api/resources/:id/report
 * Submits a quality/copyright/broken-file report for a specific resource.
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit(`report:${ip}`, {
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.allowed) {
      return apiError(
        "RATE_LIMITED",
        `Too many reports submitted. Please wait ${rl.retryAfterSeconds}s.`,
        429,
        { "Retry-After": String(rl.retryAfterSeconds) }
      );
    }

    const { id } = await context.params;
    const body = await req.json();
    const { reason, details } = body ?? {};

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return apiError(
        "VALIDATION_ERROR",
        "Please specify a reason for reporting this material.",
        400
      );
    }

    const existing = await getResourceById(id);
    if (!existing) {
      return apiError("NOT_FOUND", "Resource not found.", 404);
    }

    const report = await createResourceReport({
      resourceId: id,
      resourceTitle: existing.title,
      courseCode: existing.courseCode,
      reason: reason.trim().slice(0, 120),
      details: details ? String(details).trim().slice(0, 800) : undefined,
    });

    return apiSuccess({ report }, 201);
  } catch (error) {
    console.error("POST /api/resources/[id]/report error:", error);
    return apiError("INTERNAL_ERROR", "Failed to submit report.", 500);
  }
}
