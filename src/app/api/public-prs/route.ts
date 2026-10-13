import { NextRequest, NextResponse } from 'next/server';
import { parsePublicRepository } from '@/lib/github-public-actions';
import { checkVercelPublicRateLimit } from '@/lib/nexus-public-rate-limit';
import { checkVercelSharedPublicRateLimit } from '@/lib/nexus-shared-rate-limit';
import { loadPublicPulls } from '@/lib/github-public-client';
import { coordinatePublicQuery, publicRequestKey } from '@/lib/nexus-public-gate';

export const runtime = 'nodejs';

/** Fixed-host, anonymous, GET-only public GitHub PR endpoint. */
export async function GET(request: NextRequest) {
  const repository = request.nextUrl.searchParams.get('repository') || '';
  // Reject malformed or oversized parameters before retaining an in-flight key.
  // Under load these must stay HTTP 400, never become a misleading busy 503.
  try {
    parsePublicRepository(repository);
  } catch {
    return NextResponse.json(
      { error: 'Use a public GitHub repository in owner/name format.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const localLimit = checkVercelPublicRateLimit(request.headers);
  if (localLimit) {
    return NextResponse.json(
      { error: 'Request limit reached. Please retry later.' },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(localLimit.retryAfterSeconds),
        },
      },
    );
  }
  // When configured, the shared Redis counter is authoritative across
  // serverless instances and both public API routes. Failure is fail-closed.
  const sharedLimit = await checkVercelSharedPublicRateLimit(request.headers);
  if (sharedLimit.kind === 'limited') {
    return NextResponse.json(
      { error: 'Request limit reached. Please retry later.' },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(sharedLimit.retryAfterSeconds),
        },
      },
    );
  }
  if (sharedLimit.kind === 'unavailable') {
    return NextResponse.json(
      { error: 'Public analysis is temporarily unavailable. Please retry shortly.' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' } },
    );
  }
  const result = await coordinatePublicQuery(publicRequestKey('prs', repository),
    () => loadPublicPulls(repository));
  return NextResponse.json(result.body, {
    status: result.status,
    headers: {
      'Cache-Control': result.status === 200 ? 'public, max-age=60, stale-while-revalidate=120' : 'no-store',
      ...(result.status === 429 && result.retryAfterSeconds !== undefined
        ? { 'Retry-After': String(result.retryAfterSeconds) } : {}),
    },
  });
}
