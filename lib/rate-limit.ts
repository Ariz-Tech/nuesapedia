/**
 * In-memory sliding window rate limiter
 * Protects critical endpoints (auth, uploads, AI) from brute-force and DoS attacks.
 * Safe for serverless & edge runtimes with automatic stale entry cleanup.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up old entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 3600000); // 1 hour window
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, 300000);
}

export interface RateLimitOptions {
  intervalMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { intervalMs: 60000, maxRequests: 20 }
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(identifier) || { timestamps: [] };

  // Filter timestamps within the current sliding window
  const windowStart = now - options.intervalMs;
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= options.maxRequests) {
    const oldestTimestamp = record.timestamps[0];
    const resetMs = Math.max(0, oldestTimestamp + options.intervalMs - now);
    rateLimitStore.set(identifier, record);
    return {
      success: false,
      limit: options.maxRequests,
      remaining: 0,
      resetMs,
    };
  }

  // Record this request
  record.timestamps.push(now);
  rateLimitStore.set(identifier, record);

  return {
    success: true,
    limit: options.maxRequests,
    remaining: options.maxRequests - record.timestamps.length,
    resetMs: options.intervalMs,
  };
}

/**
 * Extract client IP from incoming Next.js Request
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}
