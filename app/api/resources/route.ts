import { NextResponse } from "next/server";
import { getAllSubmissions, initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/resources: Public directory of faculty-approved academic materials
 */
export async function GET(request: Request) {
  try {
    await initDb();

    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department");
    const level = searchParams.get("level");
    const medium = searchParams.get("medium");
    const query = searchParams.get("q") || "";

    const allApproved = await getAllSubmissions("APPROVED");

    const filtered = allApproved.filter((res) => {
      if (department && department !== "All" && res.department.toLowerCase() !== department.toLowerCase()) {
        return false;
      }
      if (level && level !== "All Levels" && res.level !== level) {
        return false;
      }
      if (medium && medium !== "All" && res.medium !== medium.toUpperCase()) {
        return false;
      }
      if (query.trim()) {
        const q = query.toLowerCase();
        const matchesTitle = res.title.toLowerCase().includes(q);
        const matchesCode = res.courseCode.toLowerCase().includes(q);
        const matchesDesc = (res.description || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesCode && !matchesDesc) return false;
      }
      return true;
    });

    return NextResponse.json({
      success: true,
      resources: filtered,
      count: filtered.length,
    });
  } catch (error) {
    console.error("Fetch approved resources error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch approved resources" },
      { status: 500 }
    );
  }
}
