import { parsePublicRepository } from './github-public-actions.ts';

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
 * A share link contains *only* the public repository selection. It does not
 * carry samples, tokens, cached results, timestamps, or unrelated query keys.
 */
export function buildRepositoryShareUrl(baseUrl: string, repository: string): string {
  parsePublicRepository(repository);
  const url = new URL(baseUrl);
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname) {
    throw new Error('Unsupported share link origin.');
  }
  url.search = new URLSearchParams({ repo: repository }).toString();
  url.hash = '';
  return url.toString();
}
