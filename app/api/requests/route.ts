import { getSession } from "@/lib/auth";
import {
  createMaterialRequest,
  getMaterialRequests,
  updateMaterialRequestStatus,
  findUserById,
} from "@/lib/db";
import { isKnownDepartment } from "@/lib/departments";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-helpers";

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

    const requests = await getMaterialRequests(status, { limit, offset });
    return apiSuccess({ requests });
  } catch (error) {
    console.error("GET /api/requests error:", error);
    return apiError("INTERNAL_ERROR", "Failed to load material requests.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit(`mat_request:${ip}`, {
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.allowed) {
      return apiError(
        "RATE_LIMITED",
        `Too many material requests. Please wait ${rl.retryAfterSeconds}s.`,
        429,
        { "Retry-After": String(rl.retryAfterSeconds) }
      );
    }

    const session = await getSession();
    const user = session ? await findUserById(session.userId) : null;

    const body = await req.json();
    const {
      requesterName,
      courseCode,
      department,
      level,
      type,
      details,
    } = body ?? {};

    if (!courseCode || !department || !level || !details) {
      return apiError(
        "VALIDATION_ERROR",
        "Course code, department, level, and description details are required.",
        400
      );
    }

    if (!isKnownDepartment(department)) {
      return apiError("VALIDATION_ERROR", "Invalid engineering department.", 400);
    }

    const created = await createMaterialRequest({
      userId: user?.id,
      requesterName:
        user?.name ||
        (requesterName ? String(requesterName).trim().slice(0, 80) : "NUESA Student"),
      courseCode: String(courseCode).trim().toUpperCase().slice(0, 20),
      department,
      level: String(level).slice(0, 10),
      type: type ? String(type).slice(0, 60) : "Past Question",
      details: String(details).trim().slice(0, 800),
    });

    return apiSuccess({ request: created }, 201);
  } catch (error) {
    console.error("POST /api/requests error:", error);
    return apiError("INTERNAL_ERROR", "Failed to submit material request.", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "MODERATOR")) {
      return apiError("FORBIDDEN", "Moderator or Admin access required.", 403);
    }

    const body = await req.json();
    const { id, status } = body ?? {};

    if (!id || (status !== "OPEN" && status !== "FULFILLED")) {
      return apiError(
        "VALIDATION_ERROR",
        "Valid request id and status (OPEN or FULFILLED) are required.",
        400
      );
    }

    const updated = await updateMaterialRequestStatus(String(id), status);
    if (!updated) {
      return apiError("NOT_FOUND", "Material request not found.", 404);
    }

    return apiSuccess({ request: updated });
  } catch (error) {
    console.error("PATCH /api/requests error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update request status.", 500);
  }
}
