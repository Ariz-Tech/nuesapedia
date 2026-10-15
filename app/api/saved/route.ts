import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { addSavedResource, getSavedResources, removeSavedResource } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const items = await getSavedResources(session.userId);
  return NextResponse.json({ success: true, data: items });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { resourceId, title, courseCode, department, type, fileSize } = body;

    if (!resourceId || !title || !courseCode || !department) {
      return NextResponse.json(
        { success: false, error: "Missing required resource details" },
        { status: 400 }
      );
    }

    const saved = await addSavedResource({
      userId: session.userId,
      resourceId,
      title,
      courseCode,
      department,
      type,
      fileSize,
    });

    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    console.error("Save resource error:", error);
    return NextResponse.json({ success: false, error: "Failed to save resource" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get("resourceId");

    if (!resourceId) {
      return NextResponse.json({ success: false, error: "resourceId required" }, { status: 400 });
    }

    await removeSavedResource(session.userId, resourceId);
    return NextResponse.json({ success: true, message: "Resource removed" });
  } catch (error) {
    console.error("Remove resource error:", error);
    return NextResponse.json({ success: false, error: "Failed to remove resource" }, { status: 500 });
  }
}
