import { after } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getSubmissionById,
  updateSubmission,
  deleteSubmissionWithChecks,
  findDuplicateSubmissionByHash,
} from "@/lib/db";
import { sendNewSubmissionAlertEmail } from "@/lib/email";
import {
  isR2Configured,
  verifyR2PdfObject,
  deleteR2Object,
  MAX_PDF_UPLOAD_BYTES,
} from "@/lib/r2";
import { mockR2Store } from "@/lib/mock-r2-store";
import {
  apiError,
  apiSuccess,
  formatBytes,
  isSafeStorageKey,
} from "@/lib/api-helpers";

/**
 * POST /api/uploads/:id/complete
 * Verifies the uploaded PDF object exists in storage, respects the 30MB cap,
 * and carries a valid `%PDF-` signature before promoting `UPLOADING -> PENDING_REVIEW`.
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }

    const { id } = await context.params;
    const submission = await getSubmissionById(id);

    if (!submission) {
      return apiError("NOT_FOUND", "Upload session not found.", 404);
    }

    if (
      submission.userId !== session.userId &&
      session.role !== "ADMIN" &&
      session.role !== "MODERATOR"
    ) {
      return apiError(
        "FORBIDDEN",
        "You do not own this upload session.",
        403
      );
    }

    const body = await req.json().catch(() => ({}));
    // Strict storage key binding: cannot substitute arbitrary bucket keys or traversal sequences
    let targetKey: string | undefined = submission.r2Key;
    if (!targetKey && isSafeStorageKey(body?.r2Key)) {
      targetKey = body.r2Key.trim();
    }

    if (!targetKey || !isSafeStorageKey(targetKey)) {
      return apiError("VALIDATION_ERROR", "Missing or invalid storage object key.", 400);
    }

    let verifiedBytes: number | null = submission.fileSizeBytes ?? null;

    if (isR2Configured) {
      const check = await verifyR2PdfObject(targetKey, MAX_PDF_UPLOAD_BYTES, submission.fileName);
      if (!check.valid) {
        await deleteR2Object(targetKey);
        await deleteSubmissionWithChecks(
          { userId: session.userId, role: session.role },
          id
        );
        return apiError(
          "INVALID_UPLOAD",
          check.error || "Uploaded file failed verification.",
          400
        );
      }
      verifiedBytes = check.sizeBytes ?? verifiedBytes;
    } else if (process.env.NODE_ENV !== "production") {
      const mockObj = mockR2Store.get(targetKey);
      if (!mockObj) {
        await deleteSubmissionWithChecks(
          { userId: session.userId, role: session.role },
          id
        );
        return apiError(
          "UPLOAD_INCOMPLETE",
          "Uploaded file was not received by local mock storage.",
          400
        );
      }
      verifiedBytes = mockObj.sizeBytes;
    } else {
      return apiError(
        "STORAGE_UNCONFIGURED",
        "Object storage is not configured.",
        503
      );
    }

    // Race-safe duplicate check: if another identical file completed while this upload was in flight
    const effectiveFileHash =
      submission.fileHash ||
      (typeof body?.fileHash === "string" && /^[a-f0-9]{64}$/i.test(body.fileHash.trim())
        ? body.fileHash.trim().toLowerCase()
        : undefined);

    if (effectiveFileHash) {
      const duplicateDoc = await findDuplicateSubmissionByHash(effectiveFileHash, id);
      if (duplicateDoc) {
        await deleteR2Object(targetKey);
        await deleteSubmissionWithChecks(
          { userId: session.userId, role: session.role },
          id
        );
        const statusLabel =
          duplicateDoc.status === "APPROVED"
            ? "is already published in the library"
            : "is already pending moderator review";
        return Response.json(
          {
            success: false,
            error: {
              code: "DUPLICATE_RESOURCE",
              message: `This exact file ${statusLabel} as "${duplicateDoc.title}" (${duplicateDoc.courseCode}).`,
            },
            duplicate: duplicateDoc,
          },
          { status: 409 }
        );
      }
    }

    const updated = await updateSubmission(id, {
      r2Key: targetKey,
      fileUrl: `/api/resources/${id}/view`,
      fileSizeBytes: verifiedBytes,
      fileSize: verifiedBytes ? formatBytes(verifiedBytes) : submission.fileSize,
      fileHash: effectiveFileHash,
      status: submission.status === "APPROVED" ? "APPROVED" : "PENDING_REVIEW",
    });

    if (updated && updated.status === "PENDING_REVIEW") {
      const alertPayload = {
        resourceTitle: updated.title,
        courseCode: updated.courseCode,
        department: updated.department,
        medium: "PDF" as const,
        uploaderEmail: session.email,
      };
      try {
        after(async () => {
          await sendNewSubmissionAlertEmail(alertPayload);
        });
      } catch {
        void sendNewSubmissionAlertEmail(alertPayload);
      }
    }

    return apiSuccess({
      submission: updated,
      message: "Upload verified and queued for moderation.",
    });
  } catch (error) {
    console.error("POST /api/uploads/[id]/complete error:", error);
    return apiError("INTERNAL_ERROR", "Failed to finalize upload.", 500);
  }
}
