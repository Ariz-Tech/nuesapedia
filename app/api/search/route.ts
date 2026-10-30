import { NextResponse } from "next/server";
import { getApprovedResourcesPaginated } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

interface SearchResultItem {
  id: string;
  title: string;
  description: string;
  type: string;
  medium: string;
  department: string;
  level: string;
  course: {
    code: string;
    title: string;
  };
  fileUrl?: string;
  youtubeUrl?: string;
  highlight?: string;
}

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const rate = checkRateLimit(`search:${ip}`, {
      intervalMs: 60000,
      maxRequests: 60,
    });
    if (!rate.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Search rate limit exceeded. Please wait before trying again.",
          },
        },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const department = searchParams.get("department");
    const course = searchParams.get("course");
    const level = searchParams.get("level");
    const type = searchParams.get("type");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const result = await getApprovedResourcesPaginated({
      query: course && course !== "All" ? `${q} ${course}`.trim() : q,
      department: department !== "All" ? department : undefined,
      level: level !== "All" ? level : undefined,
      medium: type !== "All" ? type : undefined,
      page,
      limit,
    });

    // Add highlight snippets
    const data: SearchResultItem[] = result.resources.map((item) => {
      const desc = item.description || `${item.courseCode} ${item.type} - Faculty of Engineering FUOYE`;
      let highlight = desc;
      if (q && item.title.toLowerCase().includes(q.toLowerCase())) {
        highlight = `Match in title: ${item.title}`;
      } else if (q && item.courseCode.toLowerCase().includes(q.toLowerCase())) {
        highlight = `Match in course: ${item.courseCode}`;
      }

      return {
        id: item.id,
        title: item.title,
        description: desc,
        type: item.type || (item.medium === "YOUTUBE" ? "Video Tutorial" : "Lecture Note"),
        medium: item.medium || (item.youtubeUrl ? "YOUTUBE" : "PDF"),
        department: item.department,
        level: item.level,
        course: {
          code: item.courseCode,
          title: item.courseCode,
        },
        fileUrl: item.fileUrl,
        youtubeUrl: item.youtubeUrl,
        highlight,
      };
    });

    return NextResponse.json(
      {
        success: true,
        data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SEARCH_ERROR", message: "Failed to perform search" } },
      { status: 500 }
    );
  }
}
