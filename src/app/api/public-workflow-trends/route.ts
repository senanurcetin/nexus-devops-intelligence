import { NextRequest, NextResponse } from 'next/server';
import { parsePublicRepository } from '@/lib/github-public-actions';
import { trendWindow } from '@/lib/nexus-workflow-trends';
import { checkVercelPublicRateLimit } from '@/lib/nexus-public-rate-limit';
import { checkVercelSharedPublicRateLimit } from '@/lib/nexus-shared-rate-limit';
import { coordinatePublicQuery } from '@/lib/nexus-public-gate';
import { loadPublicWorkflowTrend } from '@/lib/github-public-workflow-trends';

export const runtime = 'nodejs';

/** Historical counts are NEVER fetched by initial dashboard hydration. */
export async function GET(request: NextRequest) {
  const repositories = request.nextUrl.searchParams.getAll('repository');
  const ends = request.nextUrl.searchParams.getAll('end');
  let repository: string, end: string;
  try {
    if (repositories.length !== 1 || ends.length !== 1 ||
        [...request.nextUrl.searchParams.keys()].some(k => k !== 'repository' && k !== 'end')) {
      throw new Error('Invalid query');
    }
    repository = repositories[0];
    end = ends[0];
    parsePublicRepository(repository);
    trendWindow(end);
  } catch {
    return NextResponse.json(
      { error: 'Use a valid public repository and recent completed UTC day.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const shared = await checkVercelSharedPublicRateLimit(request.headers);
  if (shared.kind === 'limited') {
    return NextResponse.json({ error: 'Request limit reached. Please retry later.' }, {
      status: 429, headers: {
        'Cache-Control': 'no-store', 'Retry-After': String(shared.retryAfterSeconds),
        'X-Nexus-Rate-Limit-Source': 'shared-redis',
      },
    });
  }
  if (shared.kind === 'unavailable') {
    return NextResponse.json({ error: 'Public analysis is temporarily unavailable. Please retry shortly.' }, {
      status: 503, headers: {
        'Cache-Control': 'no-store', 'Retry-After': '5',
        'X-Nexus-Rate-Limit-Source': 'shared-redis-unavailable',
      },
    });
  }
  if (shared.kind === 'disabled') {
    const limited = checkVercelPublicRateLimit(request.headers);
    if (limited) {
      return NextResponse.json({ error: 'Request limit reached. Please retry later.' }, {
        status: 429, headers: {
          'Cache-Control': 'no-store', 'Retry-After': String(limited.retryAfterSeconds),
          'X-Nexus-Rate-Limit-Source': 'local-fallback',
        },
      });
    }
  }
  const result = await coordinatePublicQuery(
    'workflow-trend:' + repository.toLowerCase() + ':' + end,
    () => loadPublicWorkflowTrend(repository, end),
  );
  return NextResponse.json(result.body, {
    status: result.status,
    headers: {
      'Cache-Control': result.status === 200
        ? 'public, max-age=60, stale-while-revalidate=120' : 'no-store',
      'X-Nexus-Rate-Limit-Mode': shared.kind === 'allowed' ? 'shared-redis'
        : process.env.VERCEL === '1' ? 'local-fallback' : 'inactive',
      ...(result.status === 429 ? { 'X-Nexus-Rate-Limit-Source': 'github-upstream' } : {}),
      ...(result.status === 429 && result.retryAfterSeconds !== undefined
        ? { 'Retry-After': String(result.retryAfterSeconds) } : {}),
    },
  });
}
