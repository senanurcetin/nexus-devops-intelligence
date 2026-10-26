import { parsePublicRepository } from './github-public-actions.ts';

/**
 * Accept an ordinary public GitHub repository link pasted into the search box,
 * while retaining strict owner/repo identifiers in all APIs and shared URLs.
 * No HTTP request is made. Reject URL credentials, query strings, fragments,
 * subpages, other hosts, and insecure schemes rather than persisting them.
 */
export function normalizeRepositoryInput(input: string): string {
  const candidate = input.trim();
  if (/^https?:\/\//i.test(candidate)) {
    // Match the *raw* URL: URL() normalizes /../ and percent encodings,
    // which could silently turn an unsafe deep link into a different repo.
    const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/?$/i.exec(candidate);
    if (!match) throw new Error('Use a credential-free HTTPS GitHub repository root URL.');
    const repository = match[1] + '/' + match[2];
    parsePublicRepository(repository);
    return repository;
  }
  parsePublicRepository(candidate);
  return candidate;
}

/** Only a public GitHub owner/repository identifier is accepted from a link. */
export type RepositoryLinkSelection =
  | { kind: 'absent' }
  | { kind: 'valid'; repository: string }
  | { kind: 'invalid' };

export function readRepositoryLink(search: string): RepositoryLinkSelection {
  const params = new URLSearchParams(search);
  const values = params.getAll('repo');
  if (values.length === 0) return { kind: 'absent' };
  // Duplicated or oversized input must not silently select one of several
  // values or trigger any GitHub/Redis calls.
  if (values.length !== 1 || values[0].length > 200 ||
      values[0] !== values[0].trim()) return { kind: 'invalid' };
  try {
    parsePublicRepository(values[0]);
    return { kind: 'valid', repository: values[0] };
  } catch {
    return { kind: 'invalid' };
  }
}

/**
 * Strip unrecognized URL parameters/fragments from an already loaded page
 * without navigation or fetch. A public repo share must never retain an
 * unrelated token, credential-shaped query or attacker-supplied fragment in
 * the address bar or current history entry.
 *
 * Invalid repo selections remain invalid in client state; this helper only
 * sanitizes the address, and never chooses or loads a different repository.
 */
export function canonicalRepositoryPageUrl(
  currentUrl: string,
  selection: RepositoryLinkSelection,
): string {
  const url = new URL(currentUrl);
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname ||
      url.username || url.password) {
    throw new Error('Unsupported page URL.');
  }
  url.search = '';
  url.hash = '';
  if (selection.kind === 'valid') {
    parsePublicRepository(selection.repository);
    url.searchParams.set('repo', selection.repository);
  }
  return url.toString();
}

/**
 * A share link contains *only* the public repository selection. It does not
 * carry samples, tokens, cached results, timestamps, or unrelated query keys.
 */
export function buildRepositoryShareUrl(baseUrl: string, repository: string): string {
  parsePublicRepository(repository);
  const url = new URL(baseUrl);
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname ||
      url.username || url.password) {
    throw new Error('Unsupported share link origin.');
  }
  url.search = new URLSearchParams({ repo: repository }).toString();
  url.hash = '';
  return url.toString();
}
