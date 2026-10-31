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

  return NextResponse.json(
    {
      success: healthy,
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        storage: r2Health,
      },
    },
    { status: healthy ? 200 : 503 }
  );
}
