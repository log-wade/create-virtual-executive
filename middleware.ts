import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isVoiceWorkerRequestAuthenticated } from "@/lib/internal/voice-worker-middleware-auth";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      analytics: true,
      prefix: "create-virtual-executive",
    })
  : null;

export async function middleware(request: NextRequest) {
  // Twilio webhooks use shared egress IPs; do not rate-limit them with the generic /api bucket.
  if (request.nextUrl.pathname.startsWith("/api/twilio/")) {
    return NextResponse.next();
  }

  if (!ratelimit || !request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;
  if (
    (path === "/api/tts" || path === "/api/chat/complete") &&
    isVoiceWorkerRequestAuthenticated(request)
  ) {
    return NextResponse.next();
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous";

  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
