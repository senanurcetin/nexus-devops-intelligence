import { NextRequest, NextResponse } from 'next/server';
import { parsePublicRepository } from '@/lib/github-public-actions';
import { parsePublicCommitSha, loadPublicCommitChecks } from '@/lib/github-public-commit-checks';
import { checkVercelPublicRateLimit } from '@/lib/nexus-public-rate-limit';
import { checkVercelSharedPublicRateLimit } from '@/lib/nexus-shared-rate-limit';
import { coordinatePublicQuery } from '@/lib/nexus-public-gate';

export const runtime = 'nodejs';

function cacheable(result: { status: number; body: unknown }): boolean {
  const b = result.body as { coverage?: string; truncated?: Record<string, boolean>; counts?: { pending?: number } };
  return result.status === 200 && b.coverage === 'both_sources' &&
    !b.truncated?.checks && !b.truncated?.commit_statuses && b.counts?.pending === 0;
}

/**
 * On-demand only: never invoked by initial repository selection, exports or
 * link hydration. Anonymous GitHub reads only (two upstream GETs per lookup).
 * Disabled on hosted (Vercel) deployments unless NEXUS_PUBLIC_COMMIT_CHECKS=1,
 * because the 60/hour anonymous GitHub budget is shared by every visitor.
 */
export async function GET(request: NextRequest) {
  const values = request.nextUrl.searchParams.getAll('repository');
  const shas = request.nextUrl.searchParams.getAll('sha');
  let repository: string, sha: string;
  try {
    if (values.length !== 1 || shas.length !== 1 ||
        [...request.nextUrl.searchParams.keys()].some(k => k !== 'repository' && k !== 'sha')) {
      throw new Error('Unexpected parameters');
    }
    repository = values[0];
    parsePublicRepository(repository);
    sha = parsePublicCommitSha(shas[0]);
  } catch {
    return NextResponse.json(
      { error: 'Use a valid public repository and full commit SHA.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (process.env.VERCEL === '1' && process.env.NEXUS_PUBLIC_COMMIT_CHECKS !== '1') {
    return NextResponse.json({ error: 'Commit checks are not enabled on this deployment.' }, {
      status: 404, headers: { 'Cache-Control': 'no-store' },
    });
  }
  const shared = await checkVercelSharedPublicRateLimit(request.headers);
  if (shared.kind === 'limited') {
    return NextResponse.json({ error: 'Request limit reached. Please retry later.' }, {
      status: 429,
      headers: { 'Cache-Control': 'no-store',
        'Retry-After': String(shared.retryAfterSeconds),
        'X-Nexus-Rate-Limit-Source': 'shared-redis' },
    });
  }
  if (shared.kind === 'unavailable') {
    return NextResponse.json(
      { error: 'Public analysis is temporarily unavailable. Please retry shortly.' },
      { status: 503, headers: {
        'Cache-Control': 'no-store', 'Retry-After': '5',
        'X-Nexus-Rate-Limit-Source': 'shared-redis-unavailable',
      } },
    );
  }
  if (shared.kind === 'disabled') {
    const local = checkVercelPublicRateLimit(request.headers);
    if (local) {
      return NextResponse.json({ error: 'Request limit reached. Please retry later.' }, {
        status: 429, headers: { 'Cache-Control': 'no-store',
          'Retry-After': String(local.retryAfterSeconds),
          'X-Nexus-Rate-Limit-Source': 'local-fallback',
        },
      });
    }
  }
  const result = await coordinatePublicQuery(
    'commit-checks:' + repository.toLowerCase() + ':' + sha,
    () => loadPublicCommitChecks(repository, sha),
  );
  return NextResponse.json(result.body, {
    status: result.status,
    headers: {
      // Cache only fully verified, complete, settled evidence; anything partial,
      // truncated or still pending may change and must not be cached.
      'Cache-Control': cacheable(result) ? 'public, max-age=60, stale-while-revalidate=120' : 'no-store',
      'X-Nexus-Rate-Limit-Mode': shared.kind === 'allowed' ? 'shared-redis'
        : process.env.VERCEL === '1' ? 'local-fallback' : 'inactive',
      ...(result.status === 429 ? { 'X-Nexus-Rate-Limit-Source': 'github-upstream' } : {}),
      ...(result.status === 429 && result.retryAfterSeconds !== undefined ?
        { 'Retry-After': String(result.retryAfterSeconds) } : {}),
    },
  });
}
