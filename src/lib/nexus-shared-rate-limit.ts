import { createHmac } from 'node:crypto';
import { canonicalClientIp, PUBLIC_RATE_LIMIT_REQUESTS, PUBLIC_RATE_LIMIT_WINDOW_MS } from './nexus-public-rate-limit.ts';

/**
 * Optional Redis-backed, cross-instance admission control for anonymous public APIs.
 *
 * This is an origin-level safeguard, NOT Vercel edge WAF protection: a CDN cache
 * hit may not enter this function. Both Actions and PRs share one per-IP bucket.
 *
 * Only enabled if both Upstash REST credentials are set on the server. A
 * partially configured or failing backend fails closed (503, no upstream GET).
 * The unauthenticated demo still uses the existing per-instance local guard
 * until a separate free Redis database has been provisioned and verified.
 */
const LIMIT_WINDOW_SECONDS = PUBLIC_RATE_LIMIT_WINDOW_MS / 1000;
const REDIS_TIMEOUT_MS = 1_800;

/** Atomic INCR + EXPIRE avoids a persistent key if concurrent instances race. */
const ATOMIC_COUNTER_SCRIPT = `local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
local remaining = redis.call('TTL', KEYS[1])
return {count, remaining}`;

type EnvConfig = {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
};

export type SharedRateLimitResult =
  | { kind: 'disabled' }
  | { kind: 'allowed' }
  | { kind: 'limited'; retryAfterSeconds: number }
  | { kind: 'unavailable' };

function validatedEndpoint(value: string): string | null {
  try {
    const url = new URL(value);
    // Treat admin-provided configuration as a credential boundary too:
    // do not leak the Redis bearer token to an arbitrary third-party host.
    if (
      url.protocol !== 'https:' ||
      !url.hostname.endsWith('.upstash.io') ||
      url.hostname === '.upstash.io' ||
      url.username || url.password || url.search || url.hash ||
      (url.pathname !== '/' && url.pathname !== '') ||
      url.port
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Pure/adaptable admission check; inject fetch and env for isolated tests. */
export async function checkSharedPublicRateLimitForSource(
  clientIp: string,
  options: {
    env?: EnvConfig;
    fetcher?: typeof fetch;
  } = {},
): Promise<SharedRateLimitResult> {
  const env = options.env ?? process.env;
  const url = env.UPSTASH_REDIS_REST_URL ?? '';
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? '';
  if (!url && !token) return { kind: 'disabled' };
  if (!url || !token) return { kind: 'unavailable' };

  const endpoint = validatedEndpoint(url);
  if (!endpoint) return { kind: 'unavailable' };

  // The same token and canonical IP produce the same opaque Redis key on
  // every serverless instance. No raw IP is persisted in Redis.
  const digest = createHmac('sha256', token)
    .update(canonicalClientIp(clientIp))
    .digest('hex');
  const key = `nexus:public-github:ip:${digest}`;
  const command = ['EVAL', ATOMIC_COUNTER_SCRIPT, 1, key, LIMIT_WINDOW_SECONDS];

  try {
    const response = await (options.fetcher ?? fetch)(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!response.ok) return { kind: 'unavailable' };
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('result' in body)) {
      return { kind: 'unavailable' };
    }
    const result = (body as { result: unknown }).result;
    if (!Array.isArray(result) || result.length !== 2) return { kind: 'unavailable' };
    const [count, ttl] = result;
    if (!Number.isSafeInteger(count) || count < 1 ||
        !Number.isSafeInteger(ttl) || ttl < 0 || ttl > LIMIT_WINDOW_SECONDS) {
      return { kind: 'unavailable' };
    }
    return count > PUBLIC_RATE_LIMIT_REQUESTS
      ? { kind: 'limited', retryAfterSeconds: Math.max(1, ttl) }
      : { kind: 'allowed' };
  } catch {
    // Never permit upstream GitHub fanout when an explicitly configured
    // distributed gate is unavailable.
    return { kind: 'unavailable' };
  }
}

/** Only trust Vercel's canonical forwarding identity in actual Vercel runtime. */
export async function checkVercelSharedPublicRateLimit(
  headers: Pick<Headers, 'get'>,
): Promise<SharedRateLimitResult> {
  if (process.env.VERCEL !== '1') return { kind: 'disabled' };
  return checkSharedPublicRateLimitForSource(headers.get('x-vercel-forwarded-for') ?? '');
}
