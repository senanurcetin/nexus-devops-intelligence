import { NextRequest, NextResponse } from 'next/server';
import { parsePublicRepository } from '@/lib/github-public-actions';
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
