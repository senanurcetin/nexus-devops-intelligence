import { NextRequest, NextResponse } from 'next/server';
import { parsePublicRepository } from '@/lib/github-public-actions';
import { checkVercelPublicRateLimit } from '@/lib/nexus-public-rate-limit';
import { checkVercelSharedPublicRateLimit } from '@/lib/nexus-shared-rate-limit';
import { loadPublicActions } from '@/lib/github-public-client';
import { coordinatePublicQuery, publicRequestKey } from '@/lib/nexus-public-gate';

export const runtime = 'nodejs';

/** Fixed-host, anonymous, GET-only public GitHub Actions endpoint. */
export async function GET(request: NextRequest) {
  const repositories = request.nextUrl.searchParams.getAll('repository');
  let repository: string;
  // Only one repository field and no extra parameters. Keep source identity
  // unambiguous across all five endpoints, even if a share URL is tampered with.
  // Invalid inputs must be rejected before Redis admission or GitHub fanout.
  try {
    if (repositories.length !== 1 ||
        [...request.nextUrl.searchParams.keys()].some(key => key !== 'repository')) {
      throw new Error('Unexpected query parameters');
    }
    repository = repositories[0];
    parsePublicRepository(repository);
  } catch {
    return NextResponse.json(
      { error: 'Use a public GitHub repository in owner/name format.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  // Shared Redis admission runs before any per-instance fallback or GitHub work.
  // With Redis configured, all instances consult the same atomic counter.
  const sharedLimit = await checkVercelSharedPublicRateLimit(request.headers);
  if (sharedLimit.kind === 'limited') {
    return NextResponse.json(
      { error: 'Request limit reached. Please retry later.' },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(sharedLimit.retryAfterSeconds),
          'X-Nexus-Rate-Limit-Source': 'shared-redis',
        },
      },
    );
  }
  if (sharedLimit.kind === 'unavailable') {
    return NextResponse.json(
      { error: 'Public analysis is temporarily unavailable. Please retry shortly.' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '5',
        'X-Nexus-Rate-Limit-Source': 'shared-redis-unavailable' } },
    );
  }

  // An enabled Redis counter is the sole per-IP budget authority across instances.
  // Use the process-local guard only if no shared backend was configured.
  // Otherwise a local 429 would mask whether the global counter was consulted.
  if (sharedLimit.kind === 'disabled') {
    const localLimit = checkVercelPublicRateLimit(request.headers);
    if (localLimit) {
      return NextResponse.json(
        { error: 'Request limit reached. Please retry later.' },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(localLimit.retryAfterSeconds),
            'X-Nexus-Rate-Limit-Source': 'local-fallback',
          },
        },
      );
    }
  }
  const result = await coordinatePublicQuery(publicRequestKey('actions', repository),
    () => loadPublicActions(repository));
  return NextResponse.json(result.body, {
    status: result.status,
    headers: {
      'Cache-Control': result.status === 200 ? 'public, max-age=60, stale-while-revalidate=120' : 'no-store',
      'X-Nexus-Rate-Limit-Mode': sharedLimit.kind === 'allowed' ? 'shared-redis'
        : process.env.VERCEL === '1' ? 'local-fallback' : 'inactive',
      ...(result.status === 429 ? { 'X-Nexus-Rate-Limit-Source': 'github-upstream' } : {}),
      ...(result.status === 429 && result.retryAfterSeconds !== undefined
        ? { 'Retry-After': String(result.retryAfterSeconds) } : {}),
    },
  });
}
