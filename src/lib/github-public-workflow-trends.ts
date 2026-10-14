import { parsePublicRepository } from './github-public-actions.ts';
import { githubGet, upstreamError, type GitHubFetcher, type ApiResult } from './github-public-client.ts';
import {
  trendWindow, summarizePublicWorkflowTrend, type PublicWorkflowTrend,
} from './nexus-workflow-trends.ts';

/** Exactly one anonymous, fixed-host, created-filtered GitHub REST call. */
export async function loadPublicWorkflowTrend(
  repository: string,
  end: string,
  fetcher: GitHubFetcher = fetch,
  now: Date = new Date(),
): Promise<ApiResult<PublicWorkflowTrend>> {
  let owner: string, name: string;
  let start: string;
  try {
    [owner, name] = parsePublicRepository(repository);
    start = trendWindow(end, now).start_utc;
  } catch {
    return { status: 400, body: { error: 'Use a valid public repository and recent completed UTC day.' } };
  }
  const base = 'https://api.github.com/repos/' +
    encodeURIComponent(owner) + '/' + encodeURIComponent(name) + '/actions/runs';
  // A complete UTC seven-day interval. Never paginate automatically; missing
  // rows disable all trend charts instead of implying full-repository coverage.
  const query = new URLSearchParams({
    created: start + 'T00:00:00Z..' + end + 'T23:59:59Z',
    per_page: '100',
    page: '1',
  });
  const response = await githubGet(base + '?' + query.toString(), fetcher);
  if (response.kind !== 'ok') return upstreamError(response, 'workflow trend sample');
  try {
    return {
      status: 200,
      body: summarizePublicWorkflowTrend(repository, end, response.data, now),
    };
  } catch {
    return { status: 502, body: { error: 'GitHub returned invalid workflow trend data.' } };
  }
}
