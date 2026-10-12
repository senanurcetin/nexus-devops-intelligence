import { NextRequest, NextResponse } from 'next/server';
import { loadPublicActions } from '@/lib/github-public-client';

export const runtime = 'nodejs';

/** Fixed-host, anonymous, GET-only public GitHub Actions endpoint. */
export async function GET(request: NextRequest) {
  const result = await loadPublicActions(request.nextUrl.searchParams.get('repository') || '');
  return NextResponse.json(result.body, {
    status: result.status,
    ...(result.status === 200 ? {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
    } : { headers: { 'Cache-Control': 'no-store' } }),
  });
}
