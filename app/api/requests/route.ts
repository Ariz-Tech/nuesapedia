import { NextResponse } from "next/server";
import { getSession, hasModeratorAccess } from "@/lib/auth";
import {
  createMaterialRequest,
  getMaterialRequests,
  updateMaterialRequestStatus,
} from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "ALL";
    const requests = await getMaterialRequests(status);

    return NextResponse.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error("GET /api/requests error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch material requests." },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rate = checkRateLimit(`material_req:${ip}`, {
      intervalMs: 600000,
      maxRequests: 10,
    });
    if (!rate.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests submitted recently. Please try again shortly.",
          },
        },
        { status: 429 }
      );
    }

    const session = await getSession().catch(() => null);
    const body = await request.json().catch(() => ({}));
    const { courseCode, department, level, type, details, requesterName } = body;

    if (!courseCode?.trim() || !department?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Course code and department are required.",
          },
        },
        { status: 400 }
      );
    }

    const created = await createMaterialRequest({
      userId: session?.userId,
      requesterName: requesterName?.trim() || session?.name || "Engineering Student",
      courseCode: courseCode.trim(),
      department: department.trim(),
      level: level?.trim() || "100L",
      type: type?.trim() || "Past Question",
      details: details?.trim() || "",
    });

    return NextResponse.json(
      {
        success: true,
        data: created,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/requests error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to submit material request." },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasModeratorAccess(session.role)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Moderator privileges required." },
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { id, status } = body;
    if (!id || (status !== "OPEN" && status !== "FULFILLED")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Valid id and status required." },
        },
        { status: 400 }
      );
    }

    const updated = await updateMaterialRequestStatus(id, status);
    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Material request not found." },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PATCH /api/requests error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to update request status." },
      },
      { status: 500 }
    );
  }
}

