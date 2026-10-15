import { NextResponse } from "next/server";
import { getSession, hasModeratorAccess } from "@/lib/auth";
import {
  getAllSubmissions,
  updateSubmissionStatus,
  initDb,
} from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET: Retrieve submitted resources for moderation review
 * Query parameters:
 *  - ?status=PENDING_REVIEW | APPROVED | REJECTED | ALL
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required to access moderation." },
        { status: 401 }
      );
    }

    if (!hasModeratorAccess(session.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied. Moderator or Administrator privileges required.",
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    await initDb();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "ALL";

    const submissions = await getAllSubmissions(status);

    return NextResponse.json({
      success: true,
      submissions,
      currentUserRole: session.role,
    });
  } catch (error) {
    console.error("Moderation list error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load moderation review queue." },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Review and change the status of a submission (Approve or Reject)
 * Request body:
 *  - submissionId: string
 *  - status: "APPROVED" | "REJECTED"
 *  - rejectionReason?: string (Mandatory if status === "REJECTED")
 */
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    if (!hasModeratorAccess(session.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied. Moderator or Administrator privileges required.",
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    await initDb();

    const body = await request.json();
    const { submissionId, status, rejectionReason } = body;

    if (!submissionId) {
      return NextResponse.json(
        { success: false, error: "Submission ID is required." },
        { status: 400 }
      );
    }

    if (status !== "APPROVED" && status !== "REJECTED") {
      return NextResponse.json(
        { success: false, error: "Invalid status. Must be APPROVED or REJECTED." },
        { status: 400 }
      );
    }

    if (status === "REJECTED" && (!rejectionReason || !rejectionReason.trim())) {
      return NextResponse.json(
        { success: false, error: "Please provide a rejection reason to inform the student." },
        { status: 400 }
      );
    }

    const reviewerTag = `${session.name || "Faculty Moderator"} (${session.role})`;

    const updated = await updateSubmissionStatus(submissionId, status, {
      rejectionReason: status === "REJECTED" ? rejectionReason.trim() : undefined,
      reviewedBy: reviewerTag,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Submission not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        status === "APPROVED"
          ? "Resource approved successfully and added to the official department library."
          : "Resource rejected. The contributor has been notified of the rejection reason.",
      submission: updated,
    });
  } catch (error) {
    console.error("Moderation review action error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process moderation action." },
      { status: 500 }
    );
  }
}
