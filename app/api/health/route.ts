import { checkDatabaseHealth } from "@/lib/db";
import { checkR2Health } from "@/lib/r2";
import { NextResponse } from "next/server";

const HEALTH_CACHE_TTL_MS = 10_000;

interface CachedHealthSnapshot {
  healthy: boolean;
  timestamp: string;
  dbHealth: Awaited<ReturnType<typeof checkDatabaseHealth>>;
  r2Health: Awaited<ReturnType<typeof checkR2Health>>;
  expiresAt: number;
}

let cachedSnapshot: CachedHealthSnapshot | null = null;
let inFlightCheck: Promise<CachedHealthSnapshot> | null = null;

async function getHealthSnapshot(): Promise<CachedHealthSnapshot> {
  const now = Date.now();
  if (cachedSnapshot && cachedSnapshot.expiresAt > now) {
    return cachedSnapshot;
  }
  if (inFlightCheck) {
    return inFlightCheck;
  }

  inFlightCheck = (async () => {
    const [dbHealth, r2Health] = await Promise.all([
      checkDatabaseHealth(),
      checkR2Health(),
    ]);

    const storageOk =
      process.env.NODE_ENV === "production"
        ? r2Health.configured && r2Health.reachable
        : r2Health.reachable;
    const healthy = dbHealth.connected && storageOk;

    const snapshot: CachedHealthSnapshot = {
      healthy,
      timestamp: new Date().toISOString(),
      dbHealth,
      r2Health,
      expiresAt: Date.now() + HEALTH_CACHE_TTL_MS,
    };
    cachedSnapshot = snapshot;
    return snapshot;
  })().finally(() => {
    inFlightCheck = null;
  });

  return inFlightCheck;
}

export async function GET() {
  const { healthy, timestamp, dbHealth, r2Health } = await getHealthSnapshot();

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
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=5, s-maxage=10, stale-while-revalidate=20",
        },
      }
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
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
