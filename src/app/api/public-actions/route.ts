import { NextRequest, NextResponse } from 'next/server';
import { loadPublicActions } from '@/lib/github-public-client';
import { coordinatePublicQuery, publicRequestKey } from '@/lib/nexus-public-gate';

export const runtime = 'nodejs';

/** Fixed-host, anonymous, GET-only public GitHub Actions endpoint. */
export async function GET(request: NextRequest) {
  const repository = request.nextUrl.searchParams.get('repository') || '';
  const result = await coordinatePublicQuery(publicRequestKey('actions', repository),
    () => loadPublicActions(repository));
  return NextResponse.json(result.body, {
    status: result.status,
    ...(result.status === 200 ? {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
    } : { headers: { 'Cache-Control': 'no-store' } }),
  });
}
