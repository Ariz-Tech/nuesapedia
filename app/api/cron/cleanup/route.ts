import crypto from "node:crypto";
import { pruneStaleUploads, getReadyDb, isDevMemoryMode } from "@/lib/db";
import { deleteR2Object } from "@/lib/r2";
import { apiError, apiSuccess } from "@/lib/api-helpers";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * GET /api/cron/cleanup
 * Scheduled worker endpoint to reliably prune stale uploads and purge expired rate limits
 * without unawaited background promise races inside user-facing request handlers.
 */
export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (process.env.NODE_ENV === "production") {
      if (!cronSecret) {
        return apiError(
          "SERVICE_UNAVAILABLE",
          "Cron authorization secret is unconfigured in production.",
          503
        );
      }
      const authHeader = req.headers.get("authorization") || "";
      if (!safeCompare(authHeader, `Bearer ${cronSecret}`)) {
        return apiError("UNAUTHORIZED", "Invalid cron authorization.", 401);
      }
    } else if (cronSecret) {
      const authHeader = req.headers.get("authorization") || "";
      if (!safeCompare(authHeader, `Bearer ${cronSecret}`)) {
        return apiError("UNAUTHORIZED", "Invalid cron authorization.", 401);
      }
    }

    // 1. Prune abandoned uploads older than 2 hours
    const prunedKeys = await pruneStaleUploads(120);
    let deletedR2Count = 0;
    for (const key of prunedKeys) {
      try {
        await deleteR2Object(key);
        deletedR2Count++;
      } catch (err) {
        console.error(`Failed to delete orphaned R2 object (${key}):`, err);
      }
    }

    // 2. Clean expired rate limits from PostgreSQL
    let expiredRateLimitsCleared = 0;
    if (!isDevMemoryMode()) {
      const db = await getReadyDb();
      const res = await db.query(
        `DELETE FROM rate_limits WHERE reset_at < CURRENT_TIMESTAMP`
      );
      expiredRateLimitsCleared = res.rowCount ?? 0;
    }

    return apiSuccess({
      prunedUploads: prunedKeys.length,
      deletedR2Objects: deletedR2Count,
      expiredRateLimitsCleared,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/cron/cleanup error:", error);
    return apiError("INTERNAL_ERROR", "Cleanup job failed.", 500);
  }
}

export const POST = GET;

