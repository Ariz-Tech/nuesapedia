import { DEPARTMENT_RECORDS } from "@/lib/departments";
import { getApprovedCourses } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET() {
  try {
    const courses = await getApprovedCourses();

    const departments = DEPARTMENT_RECORDS.map((dept) => {
      const deptCourses = courses.filter(
        (c) => c.department.toLowerCase() === dept.name.toLowerCase()
      );
      const resourceCount = deptCourses.reduce(
        (sum, c) => sum + (c.resourceCount || 0),
        0
      );

      return {
        ...dept,
        courseCount: deptCourses.length,
        resourceCount,
      };
    });

    return apiSuccess({ departments });
  } catch (error) {
    console.error("GET /api/departments error:", error);
    return apiError("INTERNAL_ERROR", "Failed to load departments.", 500);
  }
}
