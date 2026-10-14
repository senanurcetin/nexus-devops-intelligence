/**
 * Browser-side adapter for the two read-only NEXUS API panels.
 * Handles HTTP errors and non-JSON WAF responses without displaying raw HTML.
 */
import { safeRetryAfterSeconds } from './nexus-retry-after.ts';

export type Panel<T> = { data: T | null; error: string | null };

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
  'GitHub returned invalid pull request list data.',
  'GitHub returned invalid pull request status data.',
  ...['workflow history', 'pull requests', 'pull request details', 'pull request verification'].flatMap(subject => [
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
    // Edge-level WAF responses need not be JSON; handle 429 before parsing.
    if (response.status === 429) {
      const wait = safeRetryAfterSeconds(response.headers.get('retry-after'));
      return { data: null, error: wait === null
        ? 'Request limit reached. Please try again shortly.'
        : `Request limit reached. Please wait at least ${wait} ${wait === 1 ? 'second' : 'seconds'} before retrying.` };
    }
    let payload: unknown;
    try {
      payload = await response.json() as unknown;
    } catch {
      return { data: null, error: response.ok ?
        'The API returned an unreadable response.' :
        'GitHub data is temporarily unavailable.' };
    }
    const serverError = safeError(payload);
    if (!response.ok || serverError || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { data: null, error: serverError ?? 'GitHub data is temporarily unavailable.' };
    }
    if (validate && !validate(payload)) {
      return { data: null, error: 'The public API sample could not be verified. Please retry.' };
    }
    return { data: payload as T, error: null };
  } catch {
    // Aborted/stale requests must never appear as actionable errors.
    if (signal.aborted) return emptyPanel<T>();
    return { data: null, error: 'Network request failed. Please retry.' };
  }
}
