/**
 * Browser-side adapter for the two read-only NEXUS API panels.
 * Handles HTTP errors and non-JSON WAF responses without displaying raw HTML.
 */
import { safeRetryAfterSeconds } from './nexus-retry-after.ts';

/**
 * Sanitized observations from an EXISTING API response, not a new diagnostic
 * request. A CDN value such as MISS is not independent origin/SSO proof.
 * Never include raw headers, URLs, cookies, response bodies or credentials.
 */
export type PublicPanelReceipt = {
  status: number;
  cache: 'MISS' | 'BYPASS' | 'HIT' | 'STALE' | 'REVALIDATED' | 'not reported';
  admission: 'shared-redis' | 'local-fallback' | 'inactive' | 'not reported';
  limitSource: 'shared-redis' | 'shared-redis-unavailable' | 'local-fallback' | 'github-upstream' | 'not reported';
};
export type Panel<T> = { data: T | null; error: string | null; receipt?: PublicPanelReceipt };

export function safePublicPanelReceipt(response: Response): PublicPanelReceipt {
  const cache = response.headers.get('x-vercel-cache')?.trim().toUpperCase();
  const admission = response.headers.get('x-nexus-rate-limit-mode')?.trim().toLowerCase();
  const limitSource = response.headers.get('x-nexus-rate-limit-source')?.trim().toLowerCase();
  return {
    status: response.status,
    cache: cache === 'MISS' || cache === 'BYPASS' || cache === 'HIT' ||
      cache === 'STALE' || cache === 'REVALIDATED' ? cache : 'not reported',
    admission: admission === 'shared-redis' || admission === 'local-fallback' ||
      admission === 'inactive' ? admission : 'not reported',
    limitSource: limitSource === 'shared-redis' || limitSource === 'shared-redis-unavailable' ||
      limitSource === 'local-fallback' || limitSource === 'github-upstream' ?
      limitSource : 'not reported',
  };
}

export function emptyPanel<T>(): Panel<T> {
  return { data: null, error: null };
}

export type PanelFetcher = (url: string, init: { cache: 'no-store'; signal: AbortSignal }) => Promise<Response>;

/**
 * Only display messages produced by our public, read-only API contract.
 * Even a short JSON `error` from an intermediary, broken proxy or future
 * upstream adapter must not become a vehicle for private diagnostics.
 */
const PUBLIC_ERRORS = new Set([
  'Use a public GitHub repository in owner/name format.',
  'Public repository not found.',
  'GitHub API is currently unavailable.',
  'Request limit reached. Please retry later.',
  'Public analysis is temporarily unavailable. Please retry shortly.',
  'Public analysis is temporarily busy. Please retry shortly.',
  'Public GitHub analysis could not be completed.',
  'GitHub API rate limit reached. Please try later.',
  'GitHub API access is restricted or rate-limited.',
  'GitHub returned unexpected workflow data.',
  'GitHub returned unexpected pull request list data.',
  'Use a valid public repository and PR number.',
  'GitHub returned invalid pull request verification data.',
  'Use a valid public repository and workflow run ID.',
  'GitHub returned invalid workflow job evidence.',
  'Use a valid public repository and recent completed UTC day.',
  'GitHub returned invalid workflow trend data.',
  'GitHub returned invalid pull request list data.',
  'GitHub returned invalid pull request status data.',
  ...['workflow history', 'pull requests', 'pull request details', 'pull request verification', 'workflow run verification', 'workflow job evidence', 'workflow trend sample'].flatMap(subject => [
    `Public repository or ${subject} not found.`,
    `GitHub ${subject} request timed out.`,
    `GitHub returned invalid ${subject} JSON.`,
    `GitHub ${subject} data is currently unavailable.`,
  ]),
]);

const safeError = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      !('error' in payload)) return null;
  const value = (payload as { error?: unknown }).error;
  return typeof value === 'string' && PUBLIC_ERRORS.has(value) ? value : null;
};

export async function readPublicPanel<T>(
  url: string,
  signal: AbortSignal,
  fetcher: PanelFetcher = fetch,
  validate?: (payload: unknown) => payload is T,
): Promise<Panel<T>> {
  try {
    const response = await fetcher(url, { cache: 'no-store', signal });
    const receipt = safePublicPanelReceipt(response);
    // Edge-level WAF responses need not be JSON; handle 429 before parsing.
    if (response.status === 429) {
      const wait = safeRetryAfterSeconds(response.headers.get('retry-after'));
      return { data: null, error: wait === null
        ? 'Request limit reached. Please try again shortly.'
        : `Request limit reached. Please wait at least ${wait} ${wait === 1 ? 'second' : 'seconds'} before retrying.`, receipt };
    }
    let payload: unknown;
    try {
      payload = await response.json() as unknown;
    } catch {
      return { data: null, error: response.ok ?
        'The API returned an unreadable response.' :
        'GitHub data is temporarily unavailable.', receipt };
    }
    const serverError = safeError(payload);
    if (!response.ok || serverError || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { data: null, error: serverError ?? 'GitHub data is temporarily unavailable.', receipt };
    }
    if (validate && !validate(payload)) {
      return { data: null, error: 'The public API sample could not be verified. Please retry.', receipt };
    }
    return { data: payload as T, error: null, receipt };
  } catch {
    // Aborted/stale requests must never appear as actionable errors.
    if (signal.aborted) return emptyPanel<T>();
    return { data: null, error: 'Network request failed. Please retry.' };
  }
}
