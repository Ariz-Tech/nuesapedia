import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getResourceById, canAccessSubmission } from "@/lib/db";
import { getSignedDownloadUrl } from "@/lib/r2";
import { apiError, apiSuccess } from "@/lib/api-helpers";

/**
 * GET /api/resources/:id/view
 * Enforces moderation status and redirects (`302`) to a freshly minted 15-minute `inline`
 * signed URL (or returns JSON when `?format=json`), preventing expired S3 URL failures.
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const resource = await getResourceById(id);

    if (!resource) {
      return apiError("NOT_FOUND", "Resource not found.", 404);
    }

    const session = await getSession();
    if (!canAccessSubmission(resource, session)) {
      return apiError("NOT_FOUND", "Resource not found.", 404);
    }

    const { searchParams } = new URL(req.url);
    const wantsJson = searchParams.get("format") === "json";

    if (resource.medium === "YOUTUBE") {
      const embedUrl = resource.youtubeVideoId
        ? `https://www.youtube.com/embed/${resource.youtubeVideoId}`
        : resource.youtubeUrl || resource.fileUrl || "";
      if (wantsJson) {
        return apiSuccess({
          resourceId: resource.id,
          medium: "YOUTUBE",
          viewUrl: embedUrl,
          youtubeVideoId: resource.youtubeVideoId,
        });
      }
      return NextResponse.redirect(embedUrl);
    }

    let viewUrl: string | null = null;
    if (resource.r2Key) {
      viewUrl = await getSignedDownloadUrl({
        key: resource.r2Key,
        fileName: resource.fileName || `${resource.courseCode}-${resource.title}.pdf`,
        disposition: "inline",
        expiresInSeconds: 900,
      });
    } else if (
      resource.fileUrl &&
      resource.fileUrl.startsWith("https://") &&
      !resource.fileUrl.startsWith("/api/")
    ) {
      viewUrl = resource.fileUrl;
    }

    if (!viewUrl) {
      return apiError("FILE_UNAVAILABLE", "Preview URL unavailable.", 404);
    }

    if (wantsJson) {
      return apiSuccess({
        resourceId: resource.id,
        medium: "PDF",
        viewUrl,
        expiresInSeconds: 900,
      });
    }

    const redirectUrl = viewUrl.startsWith("/")
      ? new URL(viewUrl, req.url).toString()
      : viewUrl;

    return NextResponse.redirect(redirectUrl, {
      status: 302,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/resources/[id]/view error:", error);
    return apiError("INTERNAL_ERROR", "Failed to generate preview URL.", 500);
  }
}
