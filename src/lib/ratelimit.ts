import { ApiError } from "./errors";

/**
 * Pluggable rate limiter (fixed window). Backend, in priority order:
 *  1. Upstash Redis over REST (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or the KV_REST_API_URL/
 *     KV_REST_API_TOKEN names the Vercel Marketplace integration sets) — production on Vercel (serverless-safe).
 *  2. Any Redis via TCP (REDIS_URL, ioredis) — e.g. a self-hosted worker/server.
 *  3. In-memory — dev/tests only (per-instance, resets on cold start).
 * Redis errors fail open to the in-memory limiter so an outage doesn't take the site down.
 */
export interface RateLimiter {
  hit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterSec: number }>;
  reset(): Promise<void>;
}

class MemoryLimiter implements RateLimiter {
  private buckets = new Map<string, { count: number; reset: number }>();
  async hit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    if (this.buckets.size > 10_000) for (const [k, b] of this.buckets) if (b.reset < now) this.buckets.delete(k);
    const b = this.buckets.get(key);
    if (!b || b.reset < now) {
      this.buckets.set(key, { count: 1, reset: now + windowMs });
      return { ok: true, retryAfterSec: 0 };
    }
    b.count++;
    return { ok: b.count <= limit, retryAfterSec: Math.ceil((b.reset - now) / 1000) };
  }
  async reset() { this.buckets.clear(); }
}

class RedisLimiter implements RateLimiter {
  constructor(private redis: import("ioredis").Redis, private fallback: RateLimiter) {}
  async hit(key: string, limit: number, windowMs: number) {
    try {
      const k = `rl:${key}`;
      const res = await this.redis.multi().incr(k).pexpire(k, windowMs, "NX").pttl(k).exec();
      const count = Number(res?.[0]?.[1] ?? 0);
      const ttl = Number(res?.[2]?.[1] ?? windowMs);
      return { ok: count <= limit, retryAfterSec: Math.ceil(Math.max(ttl, 0) / 1000) };
    } catch (e) {
      console.warn("[ratelimit] Redis unavailable, using memory", (e as Error).message);
      return this.fallback.hit(key, limit, windowMs);
    }
  }
  async reset() {}
}

class UpstashLimiter implements RateLimiter {
  constructor(private redis: import("@upstash/redis").Redis, private fallback: RateLimiter) {}
  async hit(key: string, limit: number, windowMs: number) {
    try {
      const k = `rl:${key}`;
      const [count, , ttl] = await this.redis.pipeline().incr(k).pexpire(k, windowMs, "NX").pttl(k).exec<[number, number, number]>();
      return { ok: Number(count) <= limit, retryAfterSec: Math.ceil(Math.max(Number(ttl), 0) / 1000) };
    } catch (e) {
      console.warn("[ratelimit] Upstash unavailable, using memory", (e as Error).message);
      return this.fallback.hit(key, limit, windowMs);
    }
  }
  async reset() {}
}

export function limiterBackend(env = process.env): "upstash" | "redis" | "memory" {
  if ((env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) || (env.KV_REST_API_URL && env.KV_REST_API_TOKEN)) return "upstash";
  if (env.REDIS_URL) return "redis";
  return "memory";
}

const g = globalThis as unknown as { limiter?: RateLimiter };
function create(): RateLimiter {
  const mem = new MemoryLimiter();
  const backend = limiterBackend();
  if (backend === "upstash") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL!;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN!;
    return new UpstashLimiter(new Redis({ url, token }), mem);
  }
  if (backend === "memory") {
    if (process.env.NODE_ENV === "production" && process.env.VERCEL) console.warn("[ratelimit] No Upstash/Redis configured: using per-instance memory limits");
    return mem;
  }
  const url = process.env.REDIS_URL!;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: Redis } = require("ioredis") as typeof import("ioredis");
  return new RedisLimiter(new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false }), mem);
}
export const limiter: RateLimiter = (g.limiter ??= create());

export async function rateLimit(key: string, limit = 10, windowMs = 60_000) {
  const r = await limiter.hit(key, limit, windowMs);
  if (!r.ok) throw new ApiError("RATE_LIMITED", undefined, { "Retry-After": String(r.retryAfterSec) });
}
export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
export const resetRateLimits = () => limiter.reset();
