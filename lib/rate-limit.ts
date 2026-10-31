import { getReadyDb, isDevMemoryMode } from "./db/pool";

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryRateLimitStore = new Map<string, RateLimitEntry>();

function checkMemoryRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  if (memoryRateLimitStore.size > 5000) {
    for (const [k, v] of memoryRateLimitStore.entries()) {
      if (v.resetAt <= now) memoryRateLimitStore.delete(k);
    }
  }

  const existing = memoryRateLimitStore.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + config.windowMs;
    memoryRateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(0, config.limit - 1),
      resetAt,
      retryAfterSeconds: Math.ceil(config.windowMs / 1000),
    };
  }

  if (existing.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, config.limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/**
 * Distributed PostgreSQL-backed sliding/fixed window rate limiter safe across
 * serverless isolates, with local memory mode for zero-DB dev/test environments.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (isDevMemoryMode()) {
    return checkMemoryRateLimit(key, config);
  }

  try {
    const db = await getReadyDb();
    const now = Date.now();
    const nextResetIso = new Date(now + config.windowMs).toISOString();

    // Opportunistic cleanup of expired keys (~2% of calls)
    if (Math.random() < 0.02) {
      db.query(`DELETE FROM rate_limits WHERE reset_at < CURRENT_TIMESTAMP`).catch(() => {});
    }

    const res = await db.query(
      `INSERT INTO rate_limits (key, count, reset_at)
       VALUES ($1, 1, $2::timestamptz)
       ON CONFLICT (key) DO UPDATE
       SET count = CASE
             WHEN rate_limits.reset_at <= CURRENT_TIMESTAMP THEN 1
             ELSE rate_limits.count + 1
           END,
           reset_at = CASE
             WHEN rate_limits.reset_at <= CURRENT_TIMESTAMP THEN EXCLUDED.reset_at
             ELSE rate_limits.reset_at
           END
       RETURNING count, EXTRACT(EPOCH FROM reset_at) * 1000 AS reset_ms`,
      [key, nextResetIso]
    );

    const row = res.rows[0];
    const count = Number(row.count);
    const resetAt = Math.round(Number(row.reset_ms));
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

    if (count > config.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, config.limit - count),
      resetAt,
      retryAfterSeconds,
    };
  } catch {
    return checkMemoryRateLimit(key, config);
  }
}

/**
 * Extracts client IP preferring edge/platform-verified headers over raw spoofable chains.
 */
export function getClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }

  return "127.0.0.1";
}
