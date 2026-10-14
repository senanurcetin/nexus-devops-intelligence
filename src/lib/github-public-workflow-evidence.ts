import { parsePublicRepository } from './github-public-actions.ts';
import { githubGet, upstreamError, type ApiResult, type GitHubFetcher } from './github-public-client.ts';
import {
  parsePublicRunId, validateFailedRunIdentity, summarizePublicRunEvidence,
  type PublicRunEvidence,
} from './nexus-workflow-run-evidence.ts';

const invalid = (): ApiResult<never> => ({
  status: 502, body: { error: 'GitHub returned invalid workflow job evidence.' },
});

/**
 * Explicit failed-run inspection only, max TWO sequential GitHub GETs.
 * Never fetch raw logs or fan out to every workflow run on page load.
 */
export async function loadPublicWorkflowRunEvidence(
  repository: string, id: number, fetcher: GitHubFetcher = fetch,
): Promise<ApiResult<PublicRunEvidence>> {
  let owner: string, name: string;
  try {
    [owner, name] = parsePublicRepository(repository);
    parsePublicRunId(String(id));
  } catch {
    return { status: 400, body: { error: 'Use a valid public repository and workflow run ID.' } };
  }
  const base = 'https://api.github.com/repos/' +
    encodeURIComponent(owner) + '/' + encodeURIComponent(name) + '/actions/runs/' + id;
  const first = await githubGet(base, fetcher);
  if (first.kind !== 'ok') return upstreamError(first, 'workflow run verification');
  let attempt: number;
  try {
    ({ run_attempt: attempt } = validateFailedRunIdentity(repository, id, first.data));
  } catch {
    return invalid();
  }
  const second = await githubGet(
    base + '/attempts/' + attempt + '/jobs?per_page=20&page=1', fetcher,
  );
  if (second.kind !== 'ok') return upstreamError(second, 'workflow job evidence');
  try {
    return { status: 200, body: summarizePublicRunEvidence(repository, id, first.data, second.data) };
  } catch {
    return invalid();
  }
}
