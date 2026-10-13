import { NextRequest, NextResponse } from 'next/server';
import { loadPublicPulls } from '@/lib/github-public-client';
import { coordinatePublicQuery, publicRequestKey } from '@/lib/nexus-public-gate';

export const runtime = 'nodejs';

/** Fixed-host, anonymous, GET-only public GitHub PR endpoint. */
export async function GET(request: NextRequest) {
  const repository = request.nextUrl.searchParams.get('repository') || '';
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
