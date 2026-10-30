import { NextResponse } from "next/server";
import { DEPARTMENT_DETAILS, getDepartmentBySlug } from "@/lib/departments";
import { COURSE_REGISTRY } from "@/lib/courses";
import { getApprovedResourcesPaginated } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ departmentId: string }>;
}

/**
 * GET /api/departments/:departmentId
 * Returns department metadata, courses, and approved resources (docs/API_SPEC.md §9.2)
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { departmentId } = await params;
    const normalizedNeedle = decodeURIComponent(departmentId).trim().toLowerCase();

    const dept =
      getDepartmentBySlug(normalizedNeedle) ||
      DEPARTMENT_DETAILS.find(
        (d) =>
          d.code.toLowerCase() === normalizedNeedle ||
          d.name.toLowerCase() === normalizedNeedle
      );

    if (!dept) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DEPARTMENT_NOT_FOUND",
            message: `Department '${departmentId}' was not found.`,
          },
        },
        { status: 404 }
      );
    }

    const courses = Object.values(COURSE_REGISTRY).filter(
      (c) => c.department.toLowerCase() === dept.name.toLowerCase()
    );

    const { resources } = await getApprovedResourcesPaginated({
      department: dept.name,
      limit: 500,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: dept.slug,
        code: dept.code,
        name: dept.name,
        shortName: dept.shortName,
        slug: dept.slug,
        description: dept.description,
        courses,
        resources,
        courseCount: courses.length,
        resourceCount: resources.length,
      },
    });
  } catch (error) {
    console.error("GET /api/departments/[departmentId] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch department details.",
        },
      },
      { status: 500 }
    );
  }
}

