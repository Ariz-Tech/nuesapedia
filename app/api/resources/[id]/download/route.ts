import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getResourceById,
  incrementResourceDownload,
  canAccessSubmission,
} from "@/lib/db";
import { getSignedDownloadUrl } from "@/lib/r2";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-helpers";

/**
 * GET /api/resources/:id/download
 * Enforces moderation status, increments download count for approved materials,
 * and issues a fresh signed `attachment` URL without proxying arbitrary URLs server-side (no SSRF).
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit(`download:${ip}`, {
      limit: 40,
      windowMs: 60 * 1000,
    });
    if (!rl.allowed) {
      return apiError(
        "RATE_LIMITED",
        `Download rate limit exceeded. Please wait ${rl.retryAfterSeconds}s.`,
        429,
        { "Retry-After": String(rl.retryAfterSeconds) }
      );
    }

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const wantsJson = searchParams.get("format") === "json";

    const resource = await getResourceById(id);
    if (!resource) {
      return apiError("NOT_FOUND", "Resource not found.", 404);
    }

    const session = await getSession();
    if (!canAccessSubmission(resource, session)) {
      return apiError("NOT_FOUND", "Resource not found.", 404);
    }

    const downloads =
      resource.status === "APPROVED"
        ? await incrementResourceDownload(id)
        : resource.downloads || 0;

    if (resource.medium === "YOUTUBE") {
      const targetUrl =
        resource.youtubeUrl ||
        (resource.youtubeVideoId
          ? `https://www.youtube.com/watch?v=${resource.youtubeVideoId}`
          : "");
      if (!targetUrl) {
        return apiError("FILE_UNAVAILABLE", "Video URL missing.", 404);
      }
      if (wantsJson) {
        return apiSuccess({
          resourceId: id,
          downloadUrl: targetUrl,
          downloads,
          medium: "YOUTUBE",
        });
      }
      return NextResponse.redirect(targetUrl);
    }

    const safeFilename = (
      resource.fileName ||
      `${resource.courseCode.replace(/\s+/g, "_")}_${resource.title.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`
    ).replace(/[^a-zA-Z0-9._-]/g, "_");

    let downloadUrl: string | null = null;
    if (resource.r2Key) {
      downloadUrl = await getSignedDownloadUrl({
        key: resource.r2Key,
        fileName: safeFilename,
        disposition: "attachment",
        expiresInSeconds: 600,
      });
    } else if (
      resource.fileUrl &&
      resource.fileUrl.startsWith("https://")
    ) {
      downloadUrl = resource.fileUrl;
    }

    if (!downloadUrl) {
      return apiError("FILE_UNAVAILABLE", "Download file unavailable.", 404);
    }

    if (wantsJson) {
      return apiSuccess({
        resourceId: id,
        downloadUrl,
        downloads,
        expiresInSeconds: 600,
      });
    }

    const redirectUrl = downloadUrl.startsWith("/")
      ? new URL(downloadUrl, req.url).toString()
      : downloadUrl;

    return NextResponse.redirect(redirectUrl, {
      status: 302,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/resources/[id]/download error:", error);
    return apiError("INTERNAL_ERROR", "Failed to generate download link.", 500);
  }
}
