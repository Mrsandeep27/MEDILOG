/**
 * In-memory rate limiter for API routes.
 * Uses a sliding window approach with automatic cleanup.
 *
 * For production at scale, replace with Redis-backed solution (e.g. @upstash/ratelimit).
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Auto-cleanup every 5 minutes to prevent memory leak
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

interface RateLimitConfig {
  /** Max requests in the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const cutoff = now - config.windowMs;

  cleanup(config.windowMs);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= config.limit) {
    const oldestInWindow = entry.timestamps[0];
    return {
      success: false,
      remaining: 0,
      retryAfterMs: oldestInWindow + config.windowMs - now,
    };
  }

  entry.timestamps.push(now);
  return {
    success: true,
    remaining: config.limit - entry.timestamps.length,
    retryAfterMs: 0,
  };
}

/** Get client IP from request, handling proxies safely */
export function getClientIp(request: Request): string {
  // On Vercel, x-forwarded-for is set by the platform (trusted)
  // Don't trust x-forwarded-for from arbitrary clients — only first hop
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Use the LAST IP (closest to the server) to prevent header spoofing
    const ips = forwarded.split(",").map((ip) => ip.trim());
    return ips[ips.length - 1] || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

// Pre-configured rate limit configs
export const RATE_LIMITS = {
  /** Auth endpoints: 5 requests per minute */
  auth: { limit: 5, windowMs: 60_000 },
  /** Signup: 3 requests per minute (stricter) */
  signup: { limit: 3, windowMs: 60_000 },
  /** OTP/ABHA: 5 requests per minute */
  otp: { limit: 5, windowMs: 60_000 },
  /** AI endpoints: 20 requests per minute */
  ai: { limit: 20, windowMs: 60_000 },
  /** General API: 60 requests per minute */
  general: { limit: 60, windowMs: 60_000 },
  /** Sync: 30 requests per minute */
  sync: { limit: 30, windowMs: 60_000 },
  /** Public endpoints (feedback): 10 per minute */
  public: { limit: 10, windowMs: 60_000 },
  /** Admin: 30 requests per minute */
  admin: { limit: 30, windowMs: 60_000 },
} as const;
