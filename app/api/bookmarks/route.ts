import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { addSavedResource, getSavedResources, removeSavedResource } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const items = await getSavedResources(session.userId);
  return NextResponse.json({ success: true, data: items });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { resourceId, title, courseCode, department, type, fileSize } = body;

    if (!resourceId) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "resourceId is required" } },
        { status: 400 }
      );
    }

    const saved = await addSavedResource({
      userId: session.userId,
      resourceId,
      title: title || "Academic Resource",
      courseCode: courseCode || "ENG",
      department: department || "Faculty of Engineering",
      type: type || "PDF",
      fileSize: fileSize || "5.0 MB",
    });

    return NextResponse.json({
      success: true,
      data: {
        id: saved.id,
        resourceId: saved.resourceId,
      },
    });
  } catch (error) {
    console.error("Bookmark error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to add bookmark" } },
      { status: 500 }
    );
  }
}
