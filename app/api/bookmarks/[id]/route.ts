import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { removeSavedResource } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  try {
    const { id: resourceId } = await params;
    if (!resourceId) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "resourceId is required" } },
        { status: 400 }
      );
    }

    await removeSavedResource(session.userId, resourceId);

    return NextResponse.json({
      success: true,
      data: {
        message: "Bookmark removed successfully",
        resourceId,
      },
    });
  } catch (error) {
    console.error("Delete bookmark error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to remove bookmark" } },
      { status: 500 }
    );
  }
}
