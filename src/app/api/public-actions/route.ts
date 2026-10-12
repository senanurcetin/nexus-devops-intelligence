import { NextRequest, NextResponse } from 'next/server';
import { parsePublicRepository, summarizePublicActions } from '@/lib/github-public-actions';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const repository = request.nextUrl.searchParams.get('repository') || '';
  let owner: string;
  let name: string;
  try {
    [owner, name] = parsePublicRepository(repository);
  } catch {
    return NextResponse.json({ error: 'Enter a public GitHub repository as owner/name.' }, { status: 400 });
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/actions/runs?per_page=10&page=1`;
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'nexus-devops-intelligence-public-preview',
      },
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 404) {
      return NextResponse.json({ error: 'Public repository or workflow history not found.' }, { status: 404 });
    }
    if (!response.ok) {
      return NextResponse.json(
        { error: 'GitHub Actions data is unavailable or rate-limited.' }, { status: 503 },
      );
    }
    return NextResponse.json(summarizePublicActions(repository, await response.json()), {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
    });
  } catch {
    return NextResponse.json(
      { error: 'Could not validate public GitHub workflow data.' }, { status: 502 },
    );
  }
}
