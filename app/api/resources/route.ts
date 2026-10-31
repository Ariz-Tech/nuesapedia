import { getApprovedResourcesPaginated } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-helpers";

/**
 * GET /api/resources
 * Public directory of faculty-approved academic materials with SQL filtering and bounded pagination.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const department = searchParams.get("department") || undefined;
    const level = searchParams.get("level") || undefined;
    const semester = searchParams.get("semester") || undefined;
    const courseCode =
      searchParams.get("course") || searchParams.get("courseCode") || undefined;
    const type = searchParams.get("type") || undefined;
    const medium = searchParams.get("medium") || undefined;
    const query =
      searchParams.get("q") || searchParams.get("query") || undefined;
    const sortBy =
      (searchParams.get("sort") as "newest" | "popular" | "title" | "course") ||
      "newest";
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "24", 10) || 24)
    );

    const result = await getApprovedResourcesPaginated({
      department,
      level,
      semester,
      courseCode,
      type,
      medium,
      query,
      sortBy,
      page,
      limit,
    });

    return apiSuccess({
      resources: result.resources,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error("GET /api/resources error:", error);
    return apiError(
      "INTERNAL_ERROR",
      "Failed to fetch approved resources.",
      500
    );
  }
}
