import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp, RATE_LIMITS } from "@/lib/security/rate-limit";

/** Map API path prefixes to rate limit configs */
function getRateLimitConfig(pathname: string) {
  if (pathname.startsWith("/api/auth/signup")) return RATE_LIMITS.signup;
  if (pathname.startsWith("/api/auth/")) return RATE_LIMITS.auth;
  if (pathname.startsWith("/api/abha")) return RATE_LIMITS.otp;
  if (pathname.startsWith("/api/ai-doctor")) return RATE_LIMITS.ai;
  if (pathname.startsWith("/api/extract")) return RATE_LIMITS.ai;
  if (pathname.startsWith("/api/lab-insights")) return RATE_LIMITS.ai;
  if (pathname.startsWith("/api/medicine-info")) return RATE_LIMITS.ai;
  if (pathname.startsWith("/api/sync")) return RATE_LIMITS.sync;
  if (pathname.startsWith("/api/admin")) return RATE_LIMITS.admin;
  if (pathname.startsWith("/api/feedback")) return RATE_LIMITS.public;
  if (pathname.startsWith("/api/")) return RATE_LIMITS.general;
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only rate-limit API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const config = getRateLimitConfig(pathname);
  if (!config) return NextResponse.next();

  const ip = getClientIp(request);
  const key = `${ip}:${pathname}`;
  const result = rateLimit(key, config);

  if (!result.success) {
    const retryAfter = Math.ceil(result.retryAfterMs / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(config.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
