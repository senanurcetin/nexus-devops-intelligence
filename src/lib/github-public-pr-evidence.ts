import {
  githubGet, upstreamError, type GitHubFetcher, type ApiResult,
} from './github-public-client.ts';
import { parsePublicRepository } from './github-public-actions.ts';
import {
  parsePublicPrNumber, summarizePublicPrVerification, type PublicPrVerification,
} from './nexus-pr-evidence.ts';

const invalid = (): ApiResult<never> => ({
  status: 502, body: { error: 'GitHub returned invalid pull request verification data.' },
});

/**
 * Explicit single-PR inspection only. No background fanout to five PRs.
 * Sequential max 3 upstream GETs:
 *   1. PR detail (verify open PR and immutable current head SHA)
 *   2. head commit check-runs (30)
 *   3. PR chronological review events (30)
 * Any failure immediately stops subsequent calls. No automatic retries.
 */
export async function loadPublicPrVerification(
  repository: string, number: number, fetcher: GitHubFetcher = fetch,
): Promise<ApiResult<PublicPrVerification>> {
  let owner: string, name: string;
  try {
    [owner, name] = parsePublicRepository(repository);
    parsePublicPrNumber(String(number));
  } catch {
    return { status: 400, body: { error: 'Use a valid public repository and PR number.' } };
  }
  const base = 'https://api.github.com/repos/' +
    encodeURIComponent(owner) + '/' + encodeURIComponent(name);
  const pr = await githubGet(base + '/pulls/' + number, fetcher);
  if (pr.kind !== 'ok') return upstreamError(pr, 'pull request verification');
  const raw = pr.data;
  const head = raw && typeof raw === 'object' && 'head' in raw &&
    (raw as { head?: unknown }).head;
  const sha = head && typeof head === 'object' && 'sha' in head &&
    (head as { sha?: unknown }).sha;
  if (!raw || typeof raw !== 'object' ||
      (raw as { number?: unknown }).number !== number ||
      (raw as { html_url?: unknown }).html_url !==
        'https://github.com/' + repository + '/pull/' + number ||
      (raw as { state?: unknown }).state !== 'open' ||
      typeof sha !== 'string' || !/^[0-9a-fA-F]{40}$/.test(sha)) return invalid();

  const checks = await githubGet(
    base + '/commits/' + sha + '/check-runs?per_page=30&page=1', fetcher,
  );
  if (checks.kind !== 'ok') return upstreamError(checks, 'pull request verification');
  // Do not spend a third GET on malformed GitHub check-run payloads.
  if (!checks.data || typeof checks.data !== 'object' ||
      !('total_count' in checks.data) || !('check_runs' in checks.data) ||
      !Number.isSafeInteger((checks.data as { total_count: unknown }).total_count) ||
      !Array.isArray((checks.data as { check_runs: unknown }).check_runs)) return invalid();
  const reviews = await githubGet(
    base + '/pulls/' + number + '/reviews?per_page=30&page=1', fetcher,
  );
  if (reviews.kind !== 'ok') return upstreamError(reviews, 'pull request verification');
  try {
    return {
      status: 200,
      body: summarizePublicPrVerification(repository, number, pr.data, checks.data, reviews.data),
    };
  } catch {
    return invalid();
  }
}
