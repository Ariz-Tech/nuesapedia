import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db";
import { isR2Configured } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Health check endpoint per docs/API_SPEC.md §50
 */
export async function GET() {
  const dbHealth = await checkDatabaseHealth();

  return NextResponse.json({
    success: true,
    data: {
      status: "ok",
      service: "The NUESA Library API",
      version: "1.0.0",
      database: dbHealth,
      storage: {
        r2Configured: isR2Configured(),
      },
      timestamp: new Date().toISOString(),
    },
  });
}

