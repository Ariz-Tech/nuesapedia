import { NextResponse } from "next/server";
import { getSession, hasModeratorAccess } from "@/lib/auth";
import {
  createResourceReport,
  getResourceById,
  getResourceReports,
  resolveResourceReport,
} from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const ip = getClientIp(request);
    const rate = checkRateLimit(`report:${ip}`, {
      intervalMs: 600000,
      maxRequests: 10,
    });
    if (!rate.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "RATE_LIMITED", message: "Too many reports submitted recently." },
        },
        { status: 429 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = (body.reason || "").trim();
    const details = (body.details || "").trim();

    if (!id || !reason) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Report reason is required." },
        },
        { status: 400 }
      );
    }

    const existing = await getResourceById(id);
    const report = await createResourceReport({
      resourceId: id,
      resourceTitle: body.resourceTitle || existing?.title || "Course Material",
      courseCode: body.courseCode || existing?.courseCode || "ENG",
      reason,
      details,
    });

    return NextResponse.json({ success: true, data: report }, { status: 201 });
  } catch (error) {
    console.error("POST /api/resources/[id]/report error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to submit issue report." },
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !hasModeratorAccess(session.role)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Moderator access required." } },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "ALL";
  const reports = await getResourceReports(status);
  return NextResponse.json({ success: true, data: reports });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || !hasModeratorAccess(session.role)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Moderator access required." } },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  if (!body.reportId) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "reportId is required." } },
      { status: 400 }
    );
  }

  const ok = await resolveResourceReport(body.reportId);
  return NextResponse.json({ success: ok });
}

