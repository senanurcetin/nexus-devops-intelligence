import type { ApiResult } from './github-public-client.ts';

/**
 * Best-effort process-local traffic protection for anonymous read-only routes.
 * - Identical concurrent lookups share one promise (no duplicate GitHub fan-out).
 * - At most 12 distinct lookups are in flight per running server instance.
 * - Entries are removed when settled: no long-lived user or repository storage.
 *
 * Serverless instances do NOT share memory. A platform-wide rate limiter and
 * network firewall are separate prerequisites for a broad public release.
 */
const MAX_DISTINCT_INFLIGHT = 12;
const active = new Map<string, Promise<ApiResult<unknown>>>();

export function publicRequestKey(kind: 'actions' | 'prs', repository: string): string {
  return `${kind}:${repository.trim().toLowerCase()}`;
}

export function coordinatePublicQuery<T>(
  key: string,
  load: () => Promise<ApiResult<T>>,
): Promise<ApiResult<T>> {
  const existing = active.get(key);
  if (existing) return existing as Promise<ApiResult<T>>;

  if (active.size >= MAX_DISTINCT_INFLIGHT) {
    return Promise.resolve({
      status: 503,
      body: { error: 'Public analysis is temporarily busy. Please retry shortly.' },
    });
  }

  const promise: Promise<ApiResult<T>> = Promise.resolve()
    .then(load)
    .catch(() => ({
      status: 502,
      body: { error: 'Public GitHub analysis could not be completed.' },
    }))
    .finally(() => {
      if (active.get(key) === promise) active.delete(key);
    }) as Promise<ApiResult<T>>;

  active.set(key, promise as Promise<ApiResult<unknown>>);
  return promise;
}
