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
const MAX_MEMORY_ENTRIES = 10_000;
const MEMORY_SWEEP_INTERVAL_MS = 30_000;
let lastMemorySweepAt = 0;

const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX =
  /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^([0-9a-fA-F]{1,4}:)+::?([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$/;

function isValidIp(ip: string): boolean {
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}

function checkMemoryRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  // Throttle expired-key sweeps so high-cardinality bursts never trigger O(N) scans per request
  if (
    memoryRateLimitStore.size > 2000 &&
    now - lastMemorySweepAt >= MEMORY_SWEEP_INTERVAL_MS
  ) {
    lastMemorySweepAt = now;
    for (const [k, v] of memoryRateLimitStore.entries()) {
      if (v.resetAt <= now) memoryRateLimitStore.delete(k);
    }
  }
  // Hard cap to prevent unbounded heap growth under spoofed/distributed bursts
  if (memoryRateLimitStore.size >= MAX_MEMORY_ENTRIES && !memoryRateLimitStore.has(key)) {
    const oldestKey = memoryRateLimitStore.keys().next().value;
    if (oldestKey !== undefined) {
      memoryRateLimitStore.delete(oldestKey);
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
 * Optional zero-dependency Upstash Redis REST sliding/fixed window rate limiter.
 * Offloads high-throughput rate-limit writes away from the primary PostgreSQL pool
 * whenever `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured.
 */
async function checkUpstashRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  const redisKey = `rl:${key}`;
  const windowSec = Math.max(1, Math.ceil(config.windowMs / 1000));
  const res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["PTTL", redisKey],
    ]),
    signal: AbortSignal.timeout(2500),
  });

  if (!res.ok) return null;
  const results = (await res.json()) as Array<{ result?: number }>;
  const count = Number(results?.[0]?.result ?? 1);
  let pttl = Number(results?.[1]?.result ?? -1);

  if (count === 1 || pttl < 0) {
    pttl = windowSec * 1000;
    await fetch(`${url.replace(/\/$/, "")}/expire/${encodeURIComponent(redisKey)}/${windowSec}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2000),
    }).catch(() => {});
  }

  const now = Date.now();
  const resetAt = now + Math.max(1000, pttl);
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

  return {
    allowed: count <= config.limit,
    remaining: Math.max(0, config.limit - count),
    resetAt,
    retryAfterSeconds,
  };
}

/**
 * Distributed rate limiter: prefers Upstash Redis REST when configured (zero Postgres
 * write amplification), falls back to PostgreSQL across serverless isolates, and uses
 * local memory mode in zero-DB dev/test environments.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (isDevMemoryMode()) {
    return checkMemoryRateLimit(key, config);
  }

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const redisResult = await checkUpstashRateLimit(key, config);
      if (redisResult) return redisResult;
    } catch (err) {
      console.warn(
        "[rate-limit] Upstash Redis unavailable; falling back to PostgreSQL limiter:",
        err instanceof Error ? err.message : err
      );
    }
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
  } catch (error) {
    // Intentionally fail-OPEN: if the shared PostgreSQL limiter is unreachable we
    // degrade to a per-process in-memory limiter so a DB blip cannot lock everyone out
    // of auth-critical endpoints. This degradation MUST be observable — a silent
    // fallback lets an attacker spread requests across serverless isolates to multiply
    // the effective limit. Emitting a warning here makes that visible in logs/alerting.
    console.warn(
      "[rate-limit] PostgreSQL limiter unavailable; degrading to per-instance in-memory mode.",
      error instanceof Error ? error.message : error
    );
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
