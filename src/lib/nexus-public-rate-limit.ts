import { createHash, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';

/**
 * Hobby-safe, per-instance safeguard for the two anonymous public API routes.
 *
 * NOT a global/shared limiter: Vercel Functions may run on different instances,
 * and CDN-cached requests may never reach this code. Public deployment still
 * requires a reviewed platform-wide rate limit.
 */
export const PUBLIC_RATE_LIMIT_WINDOW_MS = 60_000;
export const PUBLIC_RATE_LIMIT_REQUESTS = 20;
const MAX_SOURCE_BUCKETS = 1024;

type Bucket = { start: number; count: number };
type RateLimitResult = { retryAfterSeconds: number };
const buckets = new Map<string, Bucket>();
const salt = randomBytes(16);

function sourceKey(source: string): string {
  // Never retain or log the client's raw IP address in the request buckets.
  return createHash('sha256').update(salt).update(source).digest('hex');
}

/** Requests from both API routes consume the same local per-source budget. */
export function checkLocalPublicRateLimit(source: string, now = Date.now()): RateLimitResult | null {
  const key = sourceKey(source);
  const previous = buckets.get(key);

  if (previous && now >= previous.start && now < previous.start + PUBLIC_RATE_LIMIT_WINDOW_MS) {
    if (previous.count >= PUBLIC_RATE_LIMIT_REQUESTS) {
      return { retryAfterSeconds: Math.max(1, Math.ceil(
        (previous.start + PUBLIC_RATE_LIMIT_WINDOW_MS - now) / 1000,
      )) };
    }
    previous.count += 1;
    return null;
  }

  if (buckets.size >= MAX_SOURCE_BUCKETS) {
    // Expire stale buckets only at capacity; never let a flood of new sources
    // create unbounded per-instance memory usage.
    for (const [id, bucket] of buckets) {
      if (now < bucket.start || now >= bucket.start + PUBLIC_RATE_LIMIT_WINDOW_MS) {
        buckets.delete(id);
      }
    }
    if (buckets.size >= MAX_SOURCE_BUCKETS && !buckets.has(key)) {
      return { retryAfterSeconds: 60 };
    }
  }
  buckets.set(key, { start: now, count: 1 });
  return null;
}

/**
 * Vercel replaces the client IP forwarding header at the edge. Never trust
 * ordinary X-Forwarded-For or a custom header as an identity fallback.
 * Outside Vercel the local guard is disabled; offline tests call the pure
 * checker directly, and HTTP smoke tests retain their normal behavior.
 */
export function checkVercelPublicRateLimit(headers: Pick<Headers, 'get'>): RateLimitResult | null {
  if (process.env.VERCEL !== '1') return null;
  const forwarded = headers.get('x-vercel-forwarded-for')?.trim() ?? '';
  const source = isIP(forwarded) ? forwarded : 'unattributed';
  return checkLocalPublicRateLimit(source);
}
