import { parsePublicRepository, summarizePublicActions, type PublicActionsSummary } from './github-public-actions.ts';
import { summarizePublicPullRequests, type PublicPullSummary } from './nexus-public-prs.ts';

/** GitHub REST read-only adapter: testable without Next.js or a real network. */
export type GitHubFetcher = (
  url: string,
  init?: RequestInit & { next?: { revalidate: number } },
) => Promise<Pick<Response, 'ok' | 'status' | 'json'> & { headers?: Pick<Headers, 'get'> }>;

export type ApiError = { error: string };
export type ApiResult<T> = { status: number; body: T | ApiError };

const requestHeaders = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'nexus-devops-intelligence-public-preview',
};

const fail = (status: number, error: string): ApiResult<never> => ({ status, body: { error } });

type FetchResult =
  | { kind: 'ok'; data: unknown }
  | { kind: 'not_found' | 'rate_limited' | 'denied' | 'unavailable' | 'timeout' | 'invalid' | 'network' };

async function githubGet(url: string, fetcher: GitHubFetcher): Promise<FetchResult> {
  let response: Awaited<ReturnType<GitHubFetcher>>;
  try {
    response = await fetcher(url, {
      headers: requestHeaders,
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(10000),
    });
  } catch (cause) {
    if (cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError')) {
      return { kind: 'timeout' };
    }
    return { kind: 'network' };
  }
  if (response.status === 404) return { kind: 'not_found' };
  if (response.status === 429 ||
      (response.status === 403 && response.headers?.get('x-ratelimit-remaining') === '0')) {
    return { kind: 'rate_limited' };
  }
  if (response.status === 401 || response.status === 403) return { kind: 'denied' };
  if (!response.ok) return { kind: 'unavailable' };
  try {
    return { kind: 'ok', data: await response.json() as unknown };
  } catch {
    return { kind: 'invalid' };
  }
}

function upstreamError(result: Exclude<FetchResult, { kind: 'ok' }>, subject: string): ApiResult<never> {
  switch (result.kind) {
    case 'not_found': return fail(404, `Public repository or ${subject} not found.`);
    case 'rate_limited': return fail(429, 'GitHub API rate limit reached. Please try later.');
    case 'denied': return fail(503, 'GitHub API access is restricted or rate-limited.');
    case 'timeout': return fail(504, `GitHub ${subject} request timed out.`);
    case 'invalid': return fail(502, `GitHub returned invalid ${subject} JSON.`);
    default: return fail(503, `GitHub ${subject} data is currently unavailable.`);
  }
}

function apiRepositoryPath(repository: string): string | null {
  try {
    const [owner, name] = parsePublicRepository(repository);
    return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  } catch {
    return null;
  }
}

/** At most one anonymous GitHub API request, with a fixed host and safe URLs. */
export async function loadPublicActions(
  repository: string,
  fetcher: GitHubFetcher = fetch,
): Promise<ApiResult<PublicActionsSummary>> {
  const base = apiRepositoryPath(repository);
  if (!base) return fail(400, 'Use a public GitHub repository in owner/name format.');
  const response = await githubGet(`${base}/actions/runs?per_page=10&page=1`, fetcher);
  if (response.kind !== 'ok') return upstreamError(response, 'workflow history');
  try {
    return { status: 200, body: summarizePublicActions(repository, response.data) };
  } catch {
    return fail(502, 'GitHub returned unexpected workflow data.');
  }
}

/** One list GET plus at most five detail GETs; errors on details never invent merge success. */
export async function loadPublicPulls(
  repository: string,
  fetcher: GitHubFetcher = fetch,
): Promise<ApiResult<PublicPullSummary>> {
  const base = apiRepositoryPath(repository);
  if (!base) return fail(400, 'Use a public GitHub repository in owner/name format.');
  const response = await githubGet(`${base}/pulls?state=open&per_page=6&page=1`, fetcher);
  if (response.kind !== 'ok') return upstreamError(response, 'pull requests');
  const list = response.data;
  if (!Array.isArray(list) || list.length > 6) {
    return fail(502, 'GitHub returned unexpected pull request list data.');
  }
  let checked: PublicPullSummary;
  try {
    // Validate URLs and identifiers before spending requests on each pull request.
    checked = summarizePublicPullRequests(repository, list, Array(Math.min(list.length, 5)).fill(null));
  } catch {
    return fail(502, 'GitHub returned invalid pull request list data.');
  }
  const details = await Promise.all(checked.pull_requests.map(async pr => {
    // Draft classification takes precedence; no reason to spend a detail request.
    if (pr.attention === 'draft') return null;
    const detail = await githubGet(`${base}/pulls/${pr.number}`, fetcher);
    return detail.kind === 'ok' ? detail.data : null;
  }));
  try {
    return { status: 200, body: summarizePublicPullRequests(repository, list, details) };
  } catch {
    return fail(502, 'GitHub returned invalid pull request status data.');
  }
}
