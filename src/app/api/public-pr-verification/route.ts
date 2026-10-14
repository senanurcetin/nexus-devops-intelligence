import { NextRequest, NextResponse } from 'next/server';
import { parsePublicRepository } from '@/lib/github-public-actions';
import { parsePublicPrNumber } from '@/lib/nexus-pr-evidence';
import { checkVercelPublicRateLimit } from '@/lib/nexus-public-rate-limit';
import { checkVercelSharedPublicRateLimit } from '@/lib/nexus-shared-rate-limit';
import { coordinatePublicQuery } from '@/lib/nexus-public-gate';
import { loadPublicPrVerification } from '@/lib/github-public-pr-evidence';

export const runtime = 'nodejs';

/**
 * On-demand only: never invoked by initial repository selection, F-01 exports
 * or F-03 link hydration. Exactly one shared Redis admission when configured.
 */
export async function GET(request: NextRequest) {
  const values = request.nextUrl.searchParams.getAll('repository');
  const numbers = request.nextUrl.searchParams.getAll('number');
  let repository: string, number: number;
  try {
    if (values.length !== 1 || numbers.length !== 1 ||
        [...request.nextUrl.searchParams.keys()].some(k => k !== 'repository' && k !== 'number')) {
      throw new Error('Unexpected parameters');
    }
    repository = values[0];
    parsePublicRepository(repository);
    number = parsePublicPrNumber(numbers[0]);
  } catch {
    return NextResponse.json(
      { error: 'Use a valid public repository and PR number.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
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
    'pr-verification:' + repository.toLowerCase() + ':' + number,
    () => loadPublicPrVerification(repository, number),
  );
  return NextResponse.json(result.body, {
    status: result.status,
    headers: {
      'Cache-Control': result.status === 200
        ? 'public, max-age=60, stale-while-revalidate=120' : 'no-store',
      'X-Nexus-Rate-Limit-Mode': shared.kind === 'allowed' ? 'shared-redis'
        : process.env.VERCEL === '1' ? 'local-fallback' : 'inactive',
      ...(result.status === 429 ? { 'X-Nexus-Rate-Limit-Source': 'github-upstream' } : {}),
      ...(result.status === 429 && result.retryAfterSeconds !== undefined ?
        { 'Retry-After': String(result.retryAfterSeconds) } : {}),
    },
  });
}
