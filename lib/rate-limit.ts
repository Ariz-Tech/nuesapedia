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

const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX =
  /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^([0-9a-fA-F]{1,4}:)+::?([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$/;

function isValidIp(ip: string): boolean {
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}

function checkMemoryRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  if (memoryRateLimitStore.size > 2000) {
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

    // Opportunistically prune expired rate-limit records (~2% of requests) to prevent table bloat
    if (Math.random() < 0.02) {
      void db
        .query(
          `DELETE FROM rate_limits WHERE reset_at < CURRENT_TIMESTAMP - INTERVAL '1 hour'`
        )
        .catch(() => {});
    }

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
 * Extracts client IP preferring edge/platform-verified headers over raw spoofable chains,
 * and validates that extracted IPs conform to valid IPv4 or IPv6 structure.
 */
export function getClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) {
    const trimmed = cfIp.trim();
    if (isValidIp(trimmed)) return trimmed;
  }

  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    const candidate = vercelIp.split(",")[0].trim();
    if (isValidIp(candidate)) return candidate;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    if (isValidIp(trimmed)) return trimmed;
  }

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of parts) {
      if (isValidIp(part)) {
        return part;
      }
    }
  }

  return "127.0.0.1";
}
