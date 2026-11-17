import { NextResponse } from "next/server";

/**
 * Small fixed-window rate limiter for expensive or abusable API routes (uploads, quiz attempts,
 * certificate generation, document downloads).
 *
 * Two backends, chosen automatically:
 *  - Upstash Redis REST (set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN): shared across
 *    all serverless instances, so the limit is real. Recommended for production.
 *  - In-memory fallback: works with zero setup, but each serverless instance keeps its own
 *    counters, so the limit is only best-effort. Good enough to stop a single hot loop; not a
 *    substitute for the shared backend.
 *
 * Sign-in rate limiting is handled by Supabase Auth itself (dashboard: Authentication → Rate
 * Limits); this helper is for the app's own routes.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const memory = new Map<string, { count: number; resetAt: number }>();
const MEMORY_MAX_KEYS = 5000;

function memoryLimit(key: string, limit: number, windowSeconds: number, now: number): RateLimitResult {
  const hit = memory.get(key);
  if (!hit || hit.resetAt <= now) {
    if (memory.size >= MEMORY_MAX_KEYS) {
      for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
      if (memory.size >= MEMORY_MAX_KEYS) memory.clear(); // bounded memory beats a perfect count
    }
    memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  hit.count += 1;
  const allowed = hit.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - hit.count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((hit.resetAt - now) / 1000)),
  };
}

async function upstashLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const redisKey = `rl:${key}:${bucket}`;
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, String(windowSeconds)],
      ]),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const out = (await res.json()) as { result?: number }[];
    const count = Number(out?.[0]?.result ?? 0);
    if (!count) return null;
    const allowed = count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: allowed ? 0 : windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds),
    };
  } catch {
    return null; // the limiter must never take the app down: fall back to memory
  }
}

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  return (await upstashLimit(key, limit, windowSeconds)) ?? memoryLimit(key, limit, windowSeconds, Date.now());
}

/** Test helper: clears the in-memory counters. */
export function resetRateLimitMemory() {
  memory.clear();
}

/** Applies a limit and returns a ready 429 response when exceeded, otherwise null. */
export async function enforceRateLimit(
  scope: string,
  identity: string,
  limit: number,
  windowSeconds: number
): Promise<NextResponse | null> {
  const result = await rateLimit(`${scope}:${identity}`, limit, windowSeconds);
  if (result.allowed) return null;
  return NextResponse.json(
    { data: null, error: "Too many requests. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } }
  );
}
