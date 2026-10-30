import { NextResponse } from "next/server";
import { getResourceById, initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Resource ID is required.",
          },
        },
        { status: 400 }
      );
    }

    await initDb();
    const resource = await getResourceById(id);

    if (!resource) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: `No resource found with ID '${id}'.`,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: resource,
      resource,
    });
  } catch (error) {
    console.error("Fetch resource by ID error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch resource.",
        },
      },
      { status: 500 }
    );
  }
}
