import { NextResponse } from "next/server";
import { DEPARTMENT_DETAILS } from "@/lib/departments";
import { COURSE_REGISTRY } from "@/lib/courses";
import { getApprovedResourcesPaginated } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/departments
 * Lists all 5 engineering departments with course & resource counts (docs/API_SPEC.md §9)
 */
export async function GET() {
  try {
    const allCourses = Object.values(COURSE_REGISTRY);
    const { resources } = await getApprovedResourcesPaginated({ limit: 1000 });

    const data = DEPARTMENT_DETAILS.map((dept) => {
      const courseCount = allCourses.filter(
        (c) => c.department.toLowerCase() === dept.name.toLowerCase()
      ).length;
      const resourceCount = resources.filter(
        (r) => r.department.toLowerCase() === dept.name.toLowerCase()
      ).length;

      return {
        id: dept.slug,
        code: dept.code,
        name: dept.name,
        shortName: dept.shortName,
        slug: dept.slug,
        description: dept.description,
        courseCount,
        resourceCount,
      };
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("GET /api/departments error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch departments.",
        },
      },
      { status: 500 }
    );
  }
}

