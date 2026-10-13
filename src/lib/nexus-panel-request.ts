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

const safeError = (payload: unknown): string | null => {
  if (payload && typeof payload === 'object' && 'error' in payload &&
      typeof (payload as { error?: unknown }).error === 'string') {
    const message = (payload as { error: string }).error.trim();
    return message.length > 0 && message.length <= 300 ? message : null;
  }
  return null;
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
