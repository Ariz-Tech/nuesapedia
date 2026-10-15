import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createSubmission,
  getUserSubmissions,
  deleteSubmission,
  initDb,
} from "@/lib/db";
import {
  generateSignedUploadUrl,
  isR2Configured,
  deleteR2Object,
  getFileUrl,
} from "@/lib/r2";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

/**
 * GET /api/uploads: Fetch submissions created by the authenticated user
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    await initDb();
    const submissions = await getUserSubmissions(session.userId);

    return NextResponse.json({
      success: true,
      submissions,
    });
  } catch (error) {
    console.error("Get submissions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch student submissions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/uploads:
 * Flow 3, Step 2: Student inputs metadata -> API generates Signed R2 Upload URL (docs/flow.md)
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "You must be signed in to submit academic resources." },
        { status: 401 }
      );
    }

    // Rate limiting: Max 20 submissions per hour per user
    const rateLimit = checkRateLimit(`upload_${session.userId}`, {
      intervalMs: 3600000,
      maxRequests: 20,
    });
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: "Submission rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    await initDb();

    const body = await request.json();
    const {
      title,
      courseCode,
      department,
      level,
      semester,
      type,
      medium = "PDF",
      description = "",
      fileName,
      fileSize,
      contentType = "application/pdf",
      youtubeUrl,
    } = body;

    if (!title || !courseCode || !department || !level) {
      return NextResponse.json(
        { success: false, error: "Missing required academic fields (Title, Course Code, Department, Level)." },
        { status: 400 }
      );
    }

    // CASE 1: YOUTUBE VIDEO TUTORIAL (No storage upload required)
    if (medium === "YOUTUBE") {
      if (!youtubeUrl) {
        return NextResponse.json(
          { success: false, error: "Please provide a valid YouTube video URL." },
          { status: 400 }
        );
      }

      const videoId = extractYouTubeId(youtubeUrl.trim());
      if (!videoId) {
        return NextResponse.json(
          { success: false, error: "Invalid YouTube URL format." },
          { status: 400 }
        );
      }

      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const cleanCourseCode = courseCode.trim().toUpperCase();

      const submission = await createSubmission({
        userId: session.userId,
        title: title.trim(),
        courseCode: cleanCourseCode,
        department: department.trim(),
        level: level.trim(),
        semester: semester?.trim() || "First Semester",
        type: type?.trim() || "Video Tutorial",
        medium: "YOUTUBE",
        description: description?.trim() || "",
        youtubeUrl: youtubeUrl.trim(),
        youtubeVideoId: videoId,
        thumbnailUrl,
        fileUrl: `https://www.youtube.com/watch?v=${videoId}`,
        fileName: `YouTube: ${title.trim()}`,
        fileSize: "Streaming Video",
        status: "PENDING_REVIEW",
      });

      return NextResponse.json(
        {
          success: true,
          isComplete: true,
          message: "YouTube tutorial submitted successfully and routed to faculty moderation queue.",
          data: {
            uploadId: submission.id,
            resourceId: submission.id,
            submission,
          },
        },
        { status: 201 }
      );
    }

    // CASE 2: CLOUDFLARE R2 SIGNED UPLOAD URL (docs/flow.md Step 2, docs/API_SPEC.md 15.1)
    if (!fileName || !fileName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { success: false, error: "Only PDF documents (.pdf) are supported for document upload." },
        { status: 400 }
      );
    }

    const uploadId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const r2Key = `documents/${uploadId}/${sanitizedName}`;

    let uploadUrl: string;

    if (isR2Configured()) {
      // Real Cloudflare R2 Pre-Signed URL
      const signed = await generateSignedUploadUrl(r2Key, contentType, 900);
      uploadUrl = signed.uploadUrl;
    } else {
      // Local development mock PUT receiver endpoint
      const baseUrl = request.headers.get("origin") || "http://localhost:3000";
      uploadUrl = `${baseUrl}/api/uploads/mock-r2?key=${encodeURIComponent(r2Key)}`;
    }

    // Save initial submission record with status PENDING_REVIEW
    const initialFileUrl = await getFileUrl(r2Key);
    const submission = await createSubmission({
      userId: session.userId,
      title: title.trim(),
      courseCode: courseCode.trim().toUpperCase(),
      department: department.trim(),
      level: level.trim(),
      semester: semester?.trim() || "First Semester",
      type: type?.trim() || "Lecture Note",
      medium: "PDF",
      description: description?.trim() || "",
      r2Key,
      fileName,
      fileSize: fileSize || "PDF Document",
      fileUrl: initialFileUrl || `/api/uploads/download?key=${encodeURIComponent(r2Key)}`,
      status: "PENDING_REVIEW",
    });

    return NextResponse.json({
      success: true,
      message: "Signed Cloudflare R2 upload URL generated.",
      data: {
        uploadId: submission.id,
        uploadUrl,
        key: r2Key,
        expiresIn: 900,
      },
    });
  } catch (error) {
    console.error("Upload initialization error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to initiate direct Cloudflare R2 upload." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/uploads?id=...
 */
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get("id");

    if (!submissionId) {
      return NextResponse.json(
        { success: false, error: "Submission ID is required" },
        { status: 400 }
      );
    }

    await initDb();
    const userSubmissions = await getUserSubmissions(session.userId);
    const target = userSubmissions.find((s) => s.id === submissionId);

    if (target?.r2Key) {
      await deleteR2Object(target.r2Key);
    }

    const deleted = await deleteSubmission(session.userId, submissionId);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Submission not found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Submission removed successfully",
    });
  } catch (error) {
    console.error("Delete submission error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete submission" },
      { status: 500 }
    );
  }
}
