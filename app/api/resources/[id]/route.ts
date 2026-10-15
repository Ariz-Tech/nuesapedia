import { NextResponse } from "next/server";
import { getResourceById, initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Resource ID is required." },
        { status: 400 }
      );
    }

    await initDb();
    const resource = await getResourceById(id);

    if (!resource) {
      return NextResponse.json(
        { success: false, error: "Resource not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      resource,
    });
  } catch (error) {
    console.error("Fetch resource by ID error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch resource." },
      { status: 500 }
    );
  }
}
