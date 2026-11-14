import { checkDatabaseHealth } from "@/lib/db";
import { checkR2Health } from "@/lib/r2";
import { NextResponse } from "next/server";

export async function GET() {
  const [dbHealth, r2Health] = await Promise.all([
    checkDatabaseHealth(),
    checkR2Health(),
  ]);

  const storageOk =
    process.env.NODE_ENV === "production"
      ? r2Health.configured && r2Health.reachable
      : r2Health.reachable;
  const healthy = dbHealth.connected && storageOk;
  const timestamp = new Date().toISOString();

  if (healthy) {
    return NextResponse.json(
      {
        success: true,
        status: "healthy",
        timestamp,
        services: {
          database: dbHealth,
          storage: r2Health,
        },
      },
      { status: 200 }
    );
  }

  // Degraded responses follow the standard failure envelope ({ success:false, error }).
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "SERVICE_DEGRADED",
        message: "One or more dependent services are unavailable.",
      },
      status: "degraded",
      timestamp,
      services: {
        database: dbHealth,
        storage: r2Health,
      },
    },
    { status: 503 }
  );
}
