import { NextResponse } from "next/server";
import { getResourceById, initDb } from "@/lib/db";
import { getSignedViewUrl, isR2Configured } from "@/lib/r2";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/resources/:id/view
 * Returns a view/stream URL for in-browser reading or playback (docs/API_SPEC.md §12.2)
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    let viewUrl: string | null = null;

    if (resource.r2Key && isR2Configured()) {
      viewUrl = await getSignedViewUrl(resource.r2Key);
    }

    if (!viewUrl && resource.fileUrl) {
      viewUrl = resource.fileUrl.startsWith("/")
        ? new URL(resource.fileUrl, request.url).toString()
        : resource.fileUrl;
    }

    if (!viewUrl && resource.youtubeUrl) {
      viewUrl = resource.youtubeUrl;
    }

    if (!viewUrl) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "No viewable stream URL attached to this resource.",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        viewUrl,
        medium: resource.medium,
        expiresIn: 900,
      },
    });
  } catch (error) {
    console.error("GET /api/resources/[id]/view error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to generate view URL.",
        },
      },
      { status: 500 }
    );
  }
}

