import { NextRequest, NextResponse } from 'next/server';
import { parsePublicRepository } from '@/lib/github-public-actions';
import { parsePublicRunId } from '@/lib/nexus-workflow-run-evidence';
import { checkVercelPublicRateLimit } from '@/lib/nexus-public-rate-limit';
import { checkVercelSharedPublicRateLimit } from '@/lib/nexus-shared-rate-limit';
import { coordinatePublicQuery } from '@/lib/nexus-public-gate';
import { loadPublicWorkflowRunEvidence } from '@/lib/github-public-workflow-evidence';

export const runtime = 'nodejs';

/** Requires a user click; shares the existing 20/min origin gate. */
export async function GET(request: NextRequest) {
  const repositories = request.nextUrl.searchParams.getAll('repository');
  const ids = request.nextUrl.searchParams.getAll('id');
  let repository: string, id: number;
  try {
    if (repositories.length !== 1 || ids.length !== 1 ||
        [...request.nextUrl.searchParams.keys()].some(k => k !== 'repository' && k !== 'id')) {
      throw new Error('Unexpected query parameters');
    }
    repository = repositories[0];
    parsePublicRepository(repository);
    id = parsePublicRunId(ids[0]);
  } catch {
    return NextResponse.json(
      { error: 'Use a valid public repository and workflow run ID.' },
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
        status: 429, headers: {
          'Cache-Control': 'no-store', 'Retry-After': String(local.retryAfterSeconds),
          'X-Nexus-Rate-Limit-Source': 'local-fallback',
        },
      });
    }
  }
  const result = await coordinatePublicQuery(
    'workflow-evidence:' + repository.toLowerCase() + ':' + id,
    () => loadPublicWorkflowRunEvidence(repository, id),
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
