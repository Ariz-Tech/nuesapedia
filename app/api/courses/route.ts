import { NextResponse } from "next/server";
import { getApprovedCourses } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/courses
 * Returns verified engineering courses derived exclusively from approved database records.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department");
    const level = searchParams.get("level");
    const semester = searchParams.get("semester");
    const query = (searchParams.get("q") || "").trim().toLowerCase();

    const courses = await getApprovedCourses();

    const filtered = courses.filter((course) => {
      if (
        department &&
        department !== "All" &&
        department !== "All Departments" &&
        course.department.toLowerCase() !== department.toLowerCase()
      ) {
        return false;
      }

      if (
        level &&
        level !== "All Levels" &&
        course.level.toLowerCase() !== level.toLowerCase()
      ) {
        return false;
      }

      if (
        semester &&
        semester !== "All Semesters" &&
        course.semester.toLowerCase() !== semester.toLowerCase()
      ) {
        return false;
      }

      if (query) {
        const matchesCode = course.code.toLowerCase().includes(query);
        const matchesTitle = course.title.toLowerCase().includes(query);
        const matchesDesc = (course.description || "").toLowerCase().includes(query);
        const matchesDept = course.department.toLowerCase().includes(query);
        if (!matchesCode && !matchesTitle && !matchesDesc && !matchesDept) {
          return false;
        }
      }

      return true;
    });

    return NextResponse.json({
      success: true,
      courses: filtered,
      count: filtered.length,
    });
  } catch (error) {
    console.error("Failed to fetch verified courses:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch verified courses from database." },
      { status: 500 }
    );
  }
}
