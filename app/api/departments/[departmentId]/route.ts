import { resolveDepartment } from "@/lib/departments";
import { getApprovedCourses, getApprovedResourcesPaginated } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(
  _req: Request,
  context: { params: Promise<{ departmentId: string }> }
) {
  try {
    const { departmentId } = await context.params;
    const dept = resolveDepartment(decodeURIComponent(departmentId));

    if (!dept) {
      return apiError("NOT_FOUND", "Engineering department not found.", 404);
    }

    const [allCourses, resourcesResult] = await Promise.all([
      getApprovedCourses(),
      getApprovedResourcesPaginated({
        department: dept.name,
        limit: 50,
      }),
    ]);

    const courses = allCourses.filter(
      (c) => c.department.toLowerCase() === dept.name.toLowerCase()
    );

    const levels = ["100L", "200L", "300L", "400L", "500L"].map((lvl) => ({
      level: lvl,
      courses: courses.filter((c) => c.level === lvl),
      resourceCount: resourcesResult.resources.filter((r) => r.level === lvl)
        .length,
    }));

    return apiSuccess({
      department: {
        ...dept,
        courseCount: courses.length,
        resourceCount: resourcesResult.total,
        levels,
        courses,
        recentResources: resourcesResult.resources.slice(0, 12),
      },
    });
  } catch (error) {
    console.error("GET /api/departments/[departmentId] error:", error);
    return apiError("INTERNAL_ERROR", "Failed to load department details.", 500);
  }
}
