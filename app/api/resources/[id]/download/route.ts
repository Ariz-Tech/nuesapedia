import { NextResponse } from "next/server";
import { getResourceById, incrementResourceDownload, initDb } from "@/lib/db";
import { getSignedDownloadUrl, isR2Configured } from "@/lib/r2";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/resources/:id/download
 * Conforms to docs/API_SPEC.md §12.1 & §49.7:
 *  - Rate limited (30/min per IP)
 *  - Increments resource download counter
 *  - Supports ?format=json returning { success: true, data: { downloadUrl, expiresIn: 900 } }
 *  - Supports ?proxy=1 for same-origin PDF binary streaming into IndexedDB Offline Vault
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const ip = getClientIp(request);
    const rate = checkRateLimit(`download:${ip}`, {
      intervalMs: 60000,
      maxRequests: 30,
    });

    if (!rate.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Download rate limit exceeded. Please wait a moment and try again.",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rate.resetMs / 1000)),
          },
        }
      );
    }

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
            message: `Course material '${id}' not found.`,
          },
        },
        { status: 404 }
      );
    }

    await incrementResourceDownload(id);

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");
    const forceProxy = searchParams.get("proxy") === "1";

    const baseName =
      resource.fileName ||
      `${resource.courseCode || "ENG"}_${resource.title || "Course_Material"}.pdf`;
    const safeFilename = (
      baseName.toLowerCase().endsWith(".pdf") ? baseName : `${baseName}.pdf`
    ).replace(/[^a-zA-Z0-9._-]/g, "_");

    // Resolve signed R2 URL if configured
    let signedR2Url: string | null = null;
    if (resource.r2Key && isR2Configured()) {
      signedR2Url = await getSignedDownloadUrl(resource.r2Key, safeFilename);
    }

    // JSON envelope mode per docs/API_SPEC.md §12.1
    if (format === "json") {
      const resolvedUrl =
        signedR2Url ||
        (resource.fileUrl
          ? resource.fileUrl.startsWith("/")
            ? new URL(
              `${resource.fileUrl}${resource.fileUrl.includes("?") ? "&" : "?"}download=1&filename=${encodeURIComponent(safeFilename)}`,
              request.url
            ).toString()
            : resource.fileUrl
          : resource.youtubeUrl || null);

      if (!resolvedUrl) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "RESOURCE_NOT_FOUND",
              message: "No downloadable file attached to this material.",
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          downloadUrl: resolvedUrl,
          expiresIn: 900,
        },
      });
    }

    // 1. Cloudflare R2 pre-signed attachment URL
    if (signedR2Url) {
      if (forceProxy) {
        const r2Stream = await fetch(signedR2Url);
        if (r2Stream.ok && r2Stream.body) {
          return new NextResponse(r2Stream.body, {
            status: 200,
            headers: {
              "Content-Type": r2Stream.headers.get("content-type") || "application/pdf",
              "Content-Disposition": `attachment; filename="${safeFilename}"`,
              "Cache-Control": "private, max-age=300",
            },
          });
        }
      }
      return NextResponse.redirect(signedR2Url);
    }

    const fileUrl = resource.fileUrl;
    if (!fileUrl) {
      if (resource.youtubeUrl) {
        return NextResponse.redirect(resource.youtubeUrl);
      }
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "No downloadable file attached to this material.",
          },
        },
        { status: 404 }
      );
    }

    // 2. Local / same-origin URL (e.g. /api/uploads/mock-r2?key=...)
    if (fileUrl.startsWith("/")) {
      const target = new URL(fileUrl, request.url);
      target.searchParams.set("download", "1");
      target.searchParams.set("filename", safeFilename);
      return NextResponse.redirect(target);
    }

    // 3. Remote storage URL (Cloudinary / public bucket) — proxy stream with attachment disposition
    try {
      const upstream = await fetch(fileUrl);
      if (upstream.ok && upstream.body) {
        const contentType = upstream.headers.get("content-type") || "application/pdf";
        return new NextResponse(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${safeFilename}"`,
            "Cache-Control": "private, max-age=300",
          },
        });
      }
    } catch {
      // Fallback to direct redirect if upstream disallows server proxy
    }

    return NextResponse.redirect(fileUrl);
  } catch (error) {
    console.error("Resource download error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to initiate download.",
        },
      },
      { status: 500 }
    );
  }
}
