import { NextResponse } from "next/server";
import { getApprovedResourcesPaginated } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/resources: Public directory of faculty-approved academic materials with SQL filtering and pagination
 * Conforms to docs/API_SPEC.md §5 & §11 while preserving legacy `resources` field for backward compatibility.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department") || searchParams.get("dept");
    const level = searchParams.get("level");
    const semester = searchParams.get("semester");
    const medium = searchParams.get("medium");
    const category = searchParams.get("category") || searchParams.get("type");
    const query =
      searchParams.get("q") ||
      searchParams.get("query") ||
      searchParams.get("search") ||
      searchParams.get("course") ||
      "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "500", 10);

    const result = await getApprovedResourcesPaginated({
      department,
      level,
      semester,
      medium,
      category,
      query,
      page,
      limit,
    });

    return NextResponse.json(
      {
        success: true,
        data: result.resources,
        resources: result.resources,
        count: result.resources.length,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        pagination: {
          page: result.page,
          limit: result.limit,
          totalItems: result.total,
          totalPages: result.totalPages,
          hasNextPage: result.page < result.totalPages,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Fetch approved resources error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch approved resources.",
        },
      },
      { status: 500 }
    );
  }
}
