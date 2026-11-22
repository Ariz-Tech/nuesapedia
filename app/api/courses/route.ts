import { getApprovedCourses } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { PUBLIC_COURSES_CACHE_HEADERS } from "@/lib/cache";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const department = searchParams.get("department");
    const level = searchParams.get("level");
    const semester = searchParams.get("semester");
    const query = searchParams.get("q")?.trim().toLowerCase();

    let courses = await getApprovedCourses(department || undefined);

    if (level && level !== "ALL" && level !== "All") {
      courses = courses.filter(
        (c) => c.level.toLowerCase() === level.toLowerCase()
      );
    }

    if (semester && semester !== "ALL" && semester !== "All") {
      courses = courses.filter(
        (c) => c.semester.toLowerCase() === semester.toLowerCase()
      );
    }

    if (query) {
      courses = courses.filter(
        (c) =>
          c.code.toLowerCase().includes(query) ||
          c.title.toLowerCase().includes(query)
      );
    }

    return apiSuccess(
      {
        total: courses.length,
        courses,
      },
      200,
      PUBLIC_COURSES_CACHE_HEADERS
    );
  } catch (error) {
    console.error("GET /api/courses error:", error);
    return apiError("INTERNAL_ERROR", "Failed to load courses.", 500);
  }
}
