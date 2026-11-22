import { resolveDepartment } from "@/lib/departments";
import {
  getApprovedCourses,
  getApprovedResourcesPaginated,
  toPublicResource,
} from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { PUBLIC_CATALOG_CACHE_HEADERS } from "@/lib/cache";

export async function GET(
  _req: Request,
  context: { params: Promise<{ departmentId: string }> }
) {
  try {
    const { departmentId } = await context.params;
    let decodedId: string;
    try {
      decodedId = decodeURIComponent(departmentId);
    } catch {
      return apiError(
        "VALIDATION_ERROR",
        "Malformed department identifier.",
        400
      );
    }
    const dept = resolveDepartment(decodedId);

    if (!dept) {
      return apiError("NOT_FOUND", "Engineering department not found.", 404);
    }

    const [courses, resourcesResult] = await Promise.all([
      getApprovedCourses(dept.name),
      getApprovedResourcesPaginated({
        department: dept.name,
        limit: 12,
      }),
    ]);

    const levels = ["100L", "200L", "300L", "400L", "500L"].map((lvl) => {
      const levelCourses = courses.filter((c) => c.level === lvl);
      const levelResourceCount = levelCourses.reduce(
        (sum, c) => sum + (c.resourceCount || 0),
        0
      );
      return {
        level: lvl,
        courses: levelCourses,
        resourceCount: levelResourceCount,
      };
    });

    return apiSuccess(
      {
        department: {
          ...dept,
          courseCount: courses.length,
          resourceCount: resourcesResult.total,
          levels,
          courses,
          recentResources: resourcesResult.resources.map(toPublicResource),
        },
      },
      200,
      PUBLIC_CATALOG_CACHE_HEADERS
    );
  } catch (error) {
    console.error("GET /api/departments/[departmentId] error:", error);
    return apiError("INTERNAL_ERROR", "Failed to load department details.", 500);
  }
}
