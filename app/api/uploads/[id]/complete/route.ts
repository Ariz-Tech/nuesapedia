import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSubmissionById, updateSubmission, initDb } from "@/lib/db";
import { getFileUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/uploads/:id/complete:
 * Flow 3, Step 4 & API Spec Section 16.1
 * Informs the platform that direct file upload to Cloudflare R2 has succeeded
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { id: uploadId } = await params;
    if (!uploadId) {
      return NextResponse.json(
        { success: false, error: "Upload ID is required" },
        { status: 400 }
      );
    }

    await initDb();

    const submission = await getSubmissionById(uploadId);
    if (!submission) {
      return NextResponse.json(
        { success: false, error: "Upload record not found" },
        { status: 404 }
      );
    }

    if (submission.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized access to this upload" },
        { status: 403 }
      );
    }

    // Resolve final permanent/pre-signed download URL from Cloudflare R2
    let fileUrl = submission.fileUrl;
    if (submission.r2Key) {
      const liveR2Url = await getFileUrl(submission.r2Key);
      if (liveR2Url) fileUrl = liveR2Url;
    }

    // Update submission status to PENDING_REVIEW
    const updated = await updateSubmission(uploadId, {
      status: "PENDING_REVIEW",
      fileUrl,
    });

    return NextResponse.json({
      success: true,
      message: "Direct Cloudflare R2 upload confirmed and submitted for faculty moderation.",
      data: {
        uploadId,
        resourceId: uploadId,
        status: "PENDING_MODERATION",
        submission: updated,
      },
    });
  } catch (error) {
    console.error("Upload completion error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to confirm upload completion." },
      { status: 500 }
    );
  }
}
