import { NextResponse } from "next/server";
import { getAllSubmissions } from "@/lib/db";

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
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const department = searchParams.get("department");
    const course = searchParams.get("course");
    const level = searchParams.get("level");
    const type = searchParams.get("type");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    // Load live approved submissions from database
    const approvedSubmissions: SearchResultItem[] = (await getAllSubmissions("APPROVED")).map((sub) => ({
      id: sub.id,
      title: sub.title,
      description: sub.description || `${sub.courseCode} ${sub.type} - Faculty of Engineering FUOYE`,
      type: sub.type || (sub.medium === "YOUTUBE" ? "Video Tutorial" : "Lecture Note"),
      medium: sub.medium || (sub.youtubeUrl ? "YOUTUBE" : "PDF"),
      department: sub.department,
      level: sub.level,
      course: {
        code: sub.courseCode,
        title: sub.courseCode,
      },
      fileUrl: sub.fileUrl,
      youtubeUrl: sub.youtubeUrl,
    }));

    let filtered = approvedSubmissions;

    if (q) {
      filtered = filtered.filter((item) => {
        const inTitle = item.title.toLowerCase().includes(q);
        const inCourseCode = item.course.code.toLowerCase().includes(q);
        const inCourseTitle = item.course.title.toLowerCase().includes(q);
        const inDesc = item.description.toLowerCase().includes(q);
        const inDept = item.department.toLowerCase().includes(q);
        return inTitle || inCourseCode || inCourseTitle || inDesc || inDept;
      });
    }

    if (department && department !== "All") {
      filtered = filtered.filter(
        (item) => item.department.toLowerCase().includes(department.toLowerCase())
      );
    }

    if (course && course !== "All") {
      filtered = filtered.filter(
        (item) => item.course.code.toLowerCase() === course.toLowerCase()
      );
    }

    if (level && level !== "All") {
      filtered = filtered.filter((item) => item.level.includes(level));
    }

    if (type && type !== "All") {
      filtered = filtered.filter((item) =>
        type.toLowerCase() === "pdf" ? item.medium === "PDF" : item.medium === "YOUTUBE"
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    // Add highlight snippets
    const data = paginated.map((item) => {
      let highlight = item.description;
      if (q && item.title.toLowerCase().includes(q)) {
        highlight = `Match in title: ${item.title}`;
      }
      return {
        ...item,
        highlight,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SEARCH_ERROR", message: "Failed to perform search" } },
      { status: 500 }
    );
  }
}
