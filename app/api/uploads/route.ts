import crypto from "node:crypto";
import { getSession } from "@/lib/auth";
import {
  getUserSubmissions,
  createSubmission,
  deleteSubmissionWithChecks,
} from "@/lib/db";
import {
  generateSignedUploadUrl,
  deleteR2Object,
  isR2Configured,
  MAX_PDF_UPLOAD_BYTES,
} from "@/lib/r2";
import { isKnownDepartment } from "@/lib/departments";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  apiError,
  apiSuccess,
  extractYouTubeId,
  formatBytes,
  parseSizeToBytes,
} from "@/lib/api-helpers";
import {
  isAllowedDocumentFilename,
  isAllowedDocumentMimeType,
  getMimeTypeForFilename,
  getFileFormatDisplay,
} from "@/lib/file-utils";

const VALID_LEVELS = ["100L", "200L", "300L", "400L", "500L"];
const VALID_SEMESTERS = ["First Semester", "Second Semester"];
const VALID_MEDIUMS = ["PDF", "YOUTUBE"] as const;
const VALID_MATERIAL_TYPES = [
  "Lecture Note",
  "Lecture Notes",
  "Past Question",
  "Past Questions",
  "Tutorial / Problem Set",
  "Full Lecture Recording",
  "Concept / Topic Explainer",
  "Past Question Solution Walkthrough",
  "Software / CAD / Simulation Tutorial",
  "Video Tutorial",
];

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }

    const submissions = await getUserSubmissions(session.userId);
    return apiSuccess({ submissions });
  } catch (error) {
    console.error("GET /api/uploads error:", error);
    return apiError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError(
        "UNAUTHORIZED",
        "You must be signed in to contribute academic resources.",
        401
      );
    }

    const ip = getClientIp(req);
    const rate = await checkRateLimit(`upload:${session.userId}:${ip}`, {
      limit: 15,
      windowMs: 15 * 60 * 1000,
    });
    if (!rate.allowed) {
      return apiError(
        "RATE_LIMITED",
        `Upload rate limit reached. Please wait ${rate.retryAfterSeconds} seconds.`,
        429,
        { "Retry-After": String(rate.retryAfterSeconds) }
      );
    }

    const body = await req.json();
    const {
      title,
      courseCode,
      department,
      level,
      semester,
      sessionYear,
      type,
      medium,
      description,
      fileName,
      fileSize,
      fileSizeBytes: rawSizeBytes,
      contentType,
      youtubeUrl,
    } = body ?? {};

    const effectiveType = medium === "YOUTUBE" ? "Video Tutorial" : String(type || "");

    if (!title || !courseCode || !department || !level || !effectiveType || !medium) {
      return apiError(
        "VALIDATION_ERROR",
        "Title, course code, department, level, material type, and medium are required.",
        400
      );
    }

    const trimmedTitle = String(title).trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 200) {
      return apiError(
        "VALIDATION_ERROR",
        "Resource title must be between 3 and 200 characters.",
        400
      );
    }

    const cleanCourseCode = String(courseCode).trim().toUpperCase();
    if (cleanCourseCode.length < 3 || cleanCourseCode.length > 20) {
      return apiError("VALIDATION_ERROR", "Invalid course code.", 400);
    }

    if (!isKnownDepartment(department)) {
      return apiError("VALIDATION_ERROR", "Invalid engineering department.", 400);
    }

    if (!VALID_LEVELS.includes(String(level))) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid academic level (100L - 500L).",
        400
      );
    }

    const cleanSemester = semester ? String(semester) : "First Semester";
    if (!VALID_SEMESTERS.includes(cleanSemester)) {
      return apiError("VALIDATION_ERROR", "Invalid semester.", 400);
    }

    if (!VALID_MATERIAL_TYPES.includes(effectiveType)) {
      return apiError("VALIDATION_ERROR", "Invalid material type.", 400);
    }

    if (!VALID_MEDIUMS.includes(medium)) {
      return apiError("VALIDATION_ERROR", "Medium must be PDF or YOUTUBE.", 400);
    }

    if (medium === "YOUTUBE") {
      if (!youtubeUrl) {
        return apiError(
          "VALIDATION_ERROR",
          "A valid YouTube video URL is required.",
          400
        );
      }

      const videoId = extractYouTubeId(String(youtubeUrl));
      if (!videoId) {
        return apiError(
          "VALIDATION_ERROR",
          "Invalid YouTube URL. Please paste a valid youtube.com/watch?v=... or youtu.be/... link.",
          400
        );
      }

      const canonicalYoutubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const submission = await createSubmission({
        userId: session.userId,
        title: trimmedTitle,
        courseCode: cleanCourseCode,
        department,
        level: String(level),
        semester: cleanSemester,
        sessionYear: sessionYear ? String(sessionYear).slice(0, 20) : "2025/2026",
        type: "Video Tutorial",
        medium: "YOUTUBE",
        description: description ? String(description).trim().slice(0, 1000) : undefined,
        fileUrl: canonicalYoutubeUrl,
        fileSize: "Streaming Video",
        youtubeUrl: canonicalYoutubeUrl,
        youtubeVideoId: videoId,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        status: "PENDING_REVIEW",
      });

      return apiSuccess({ submission }, 201);
    }

    // Document / Slides Direct-to-R2 Flow
    if (process.env.NODE_ENV === "production" && !isR2Configured) {
      return apiError(
        "STORAGE_UNCONFIGURED",
        "Cloud object storage is not configured on this server.",
        503
      );
    }

    // Prevent storage key and submission reservation flooding by bounding concurrent in-flight sessions
    const existingUserSubmissions = await getUserSubmissions(session.userId);
    const activeUploadingCount = existingUserSubmissions.filter(
      (s) => s.status === "UPLOADING"
    ).length;
    if (activeUploadingCount >= 5) {
      return apiError(
        "CONCURRENT_UPLOADS_EXCEEDED",
        "You have too many in-flight upload sessions (max 5). Please complete or cancel existing pending uploads before starting a new one.",
        429
      );
    }

    const safeFileName = (fileName ? String(fileName) : "document.pdf")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-120);

    if (!isAllowedDocumentFilename(safeFileName)) {
      return apiError(
        "VALIDATION_ERROR",
        "Unsupported file format. Please upload a PDF, Word document (.doc, .docx), slides (.ppt, .pptx), or text file.",
        400
      );
    }

    const declaredBytes =
      typeof rawSizeBytes === "number" && Number.isFinite(rawSizeBytes)
        ? Math.round(rawSizeBytes)
        : parseSizeToBytes(fileSize ? String(fileSize) : null);

    if (declaredBytes !== null && (declaredBytes <= 0 || declaredBytes > MAX_PDF_UPLOAD_BYTES)) {
      return apiError(
        "FILE_TOO_LARGE",
        "File size must be between 1 byte and 30MB.",
        413
      );
    }

    const resolvedContentType =
      contentType && isAllowedDocumentMimeType(contentType)
        ? contentType
        : getMimeTypeForFilename(safeFileName);

    const uploadId = `sub_${crypto.randomBytes(8).toString("hex")}`;
    const deptSlug = department.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const r2Key = `uploads/${deptSlug}/${cleanCourseCode.replace(/\s+/g, "")}/${uploadId}_${safeFileName}`;

    const signedUploadUrl = isR2Configured
      ? await generateSignedUploadUrl({
          key: r2Key,
          contentType: resolvedContentType,
          expiresInSeconds: 600,
        })
      : `/api/uploads/mock-r2?key=${encodeURIComponent(r2Key)}&fileName=${encodeURIComponent(safeFileName)}`;

    if (!signedUploadUrl) {
      return apiError(
        "STORAGE_ERROR",
        "Unable to generate upload URL right now.",
        500
      );
    }

    const formatInfo = getFileFormatDisplay(safeFileName);

    // Start in UPLOADING state so incomplete browser uploads never enter moderators' PENDING_REVIEW queue.
    const submission = await createSubmission({
      id: uploadId,
      userId: session.userId,
      title: trimmedTitle,
      courseCode: cleanCourseCode,
      department,
      level: String(level),
      semester: cleanSemester,
      sessionYear: sessionYear ? String(sessionYear).slice(0, 20) : "2025/2026",
      type: effectiveType,
      medium: "PDF",
      description: description ? String(description).trim().slice(0, 1000) : undefined,
      fileName: fileName ? String(fileName).slice(0, 255) : safeFileName,
      fileSize: declaredBytes
        ? formatBytes(declaredBytes)
        : fileSize
          ? String(fileSize).slice(0, 50)
          : formatInfo.label,
      fileSizeBytes: declaredBytes,
      r2Key,
      status: "UPLOADING",
    });

    return apiSuccess(
      {
        submission,
        signedUploadUrl,
        r2Key,
        storageMode: isR2Configured ? "cloudflare_r2" : "local_dev_mock",
        data: {
          uploadId: submission.id,
          uploadUrl: signedUploadUrl,
          r2Key,
          submission,
        },
      },
      201
    );
  } catch (error) {
    console.error("POST /api/uploads error:", error);
    return apiError(
      "INTERNAL_ERROR",
      "Failed to register academic contribution.",
      500
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return apiError("VALIDATION_ERROR", "Submission ID is required.", 400);
    }

    const result = await deleteSubmissionWithChecks(
      { userId: session.userId, role: session.role },
      id
    );

    if (!result.deleted) {
      if (result.reason === "ALREADY_APPROVED") {
        return apiError(
          "FORBIDDEN",
          "Approved public library resources cannot be deleted by contributors. Please use 'Report Issue' if an update or takedown is needed.",
          403
        );
      }
      if (result.reason === "FORBIDDEN") {
        return apiError("FORBIDDEN", "You cannot delete another user's submission.", 403);
      }
      return apiError("NOT_FOUND", "Submission not found.", 404);
    }

    if (result.r2Key) {
      await deleteR2Object(result.r2Key);
    }

    return apiSuccess({ message: "Submission withdrawn." });
  } catch (error) {
    console.error("DELETE /api/uploads error:", error);
    return apiError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
