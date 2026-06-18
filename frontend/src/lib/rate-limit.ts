import { NextRequest, NextResponse } from "next/server";

// ─── Redis-Backed Rate Limiter ──────────────────────────────
// Uses Upstash Redis for rate limiting across Vercel serverless
// instances. Falls back to in-memory if Redis is unavailable.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

const memStore = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();
function cleanupMem() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, val] of memStore) {
    if (now > val.resetAt) memStore.delete(key);
  }
}

async function redisIncr(key: string, windowSec: number): Promise<number | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([["INCR", key], ["TTL", key]]),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const results = await res.json();
    const count = results[0]?.result;
    const ttl = results[1]?.result;
    if (count === 1 || ttl === -1) {
      await fetch(`${UPSTASH_URL}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["EXPIRE", key, String(windowSec)]),
        cache: "no-store",
        signal: AbortSignal.timeout(2000),
      });
    }
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}

/** Returns true if the request is rate-limited (already sent 429 response) */
export async function checkRateLimit(
  request: NextRequest,
  { maxRequests = 30, windowMs = 60_000 }: { maxRequests?: number; windowMs?: number } = {},
): Promise<boolean> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const path = new URL(request.url).pathname;
  const key = `aegis:rl:${ip}:${path}`;
  const windowSec = Math.ceil(windowMs / 1000);

  const redisCount = await redisIncr(key, windowSec);
  if (redisCount !== null) return redisCount > maxRequests;

  cleanupMem();
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > maxRequests;
}

/** Convenience: returns a 429 NextResponse */
export function rateLimitResponse(): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}
