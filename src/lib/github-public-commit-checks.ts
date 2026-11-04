import type { ApiResult } from './github-public-client.ts';
import { parsePublicRepository } from './github-public-actions.ts';
import { collectCommitChecks, validateCommitTarget } from './nexus-commit-checks.mjs';

export type PublicCommitChecks = Awaited<ReturnType<typeof collectCommitChecks>>;

/**
 * Normalizes a user-supplied commit SHA. PR evidence accepts either hex case;
 * the collector accepts lowercase only, so normalize once at the boundary.
 */
export function parsePublicCommitSha(value: string): string {
  const sha = value.toLowerCase();
  validateCommitTarget('owner/name', sha);
  return sha;
}

/**
 * Explicit single-commit inspection. Exactly two anonymous upstream GETs
 * (check-runs and combined status), issued in parallel by the collector.
 * Credentials are NEVER used here: the web route must not read
 * NEXUS_GITHUB_TOKEN even if an operator set it for the local JARVIS CLI.
 */
export async function loadPublicCommitChecks(
  repository: string, sha: string, fetcher: typeof fetch = fetch,
): Promise<ApiResult<PublicCommitChecks>> {
  try {
    parsePublicRepository(repository);
    sha = parsePublicCommitSha(sha);
  } catch {
    return { status: 400, body: { error: 'Use a valid public repository and full commit SHA.' } };
  }
  const report = await collectCommitChecks({
    repository, sha, fetcher, token: undefined, allowToken: false,
  });
  if (report.coverage !== 'none') return { status: 200, body: report };
  // No verified source: never return a clean-looking success.
  const states = Object.values(report.sources);
  if (states.includes('rate_limited')) {
    return { status: 429, body: { error: 'GitHub rate limit reached. Please retry later.' } };
  }
  if (states.every(state => state === 'not_found')) {
    return { status: 404, body: { error: 'Commit or repository was not found.' } };
  }
  return { status: 502, body: { error: 'GitHub commit check data could not be verified.' } };
}
