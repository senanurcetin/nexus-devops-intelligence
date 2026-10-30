#!/usr/bin/env node
/** Public GitHub OSS evidence snapshot; not a program eligibility decision. */
import { pathToFileURL } from 'node:url';

const API = 'https://api.github.com';
const PAGE_SIZE = 100;
const MAX_PAGES = 10; // GitHub's search API exposes at most 1,000 results.

export function parseRepository(input) {
  if (typeof input !== 'string' || input.length > 150) throw new Error('Expected owner/repo');
  const parts = input.split('/');
  if (parts.length !== 2 || parts.some(part => part === '.' || part === '..' || !/^[a-zA-Z0-9_.-]{1,100}$/.test(part))) {
    throw new Error('Expected a public repository in owner/repo form');
  }
  return parts;
}

async function readPublicJson(path, fetchImpl) {
  const response = await fetchImpl(`${API}${path}`, {
    method: 'GET',
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'nexus-oss-evidence/1.0', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response?.ok) throw new Error(`GitHub API returned HTTP ${response?.status ?? 'unknown'} (evidence incomplete)`);
  return response.json();
}

function yearsAgo(now, n) {
  const date = new Date(now);
  date.setUTCFullYear(date.getUTCFullYear() - n);
  return date;
}

// GitHub API timestamps must be real canonical UTC instants, not values that
// Date.parse silently normalizes (for example '1' or 30 February).
function canonicalUtcMillis(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) return null;
  const canonical = value.includes('.') ? value : value.replace(/Z$/, '.000Z');
  return new Date(millis).toISOString() === canonical ? millis : null;
}

export async function collectCommunityEvidence(input, { fetchImpl = fetch, now = new Date() } = {}) {
  const [owner, name] = parseRepository(input);
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Invalid snapshot date');
  const encodedRepo = `${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const repository = await readPublicJson(`/repos/${encodedRepo}`, fetchImpl);
  if (repository?.private !== false || repository.full_name?.toLowerCase() !== `${owner}/${name}`.toLowerCase()) {
    throw new Error('Repository must be public and match the requested owner/repo');
  }

  const ownerProfile = await readPublicJson(`/users/${encodeURIComponent(owner)}`, fetchImpl);
  const createdMillis = canonicalUtcMillis(ownerProfile?.created_at);
  const accountCreatedAt = ownerProfile?.type === 'User' && createdMillis !== null &&
    createdMillis <= now.getTime() ? ownerProfile.created_at : null;
  const twoYearCutoff = yearsAgo(now, 2);
  const oneYearCutoff = yearsAgo(now, 1);
  const mergedSince = oneYearCutoff.toISOString().slice(0, 10);
  const query = `repo:${owner}/${name} is:pr is:merged merged:>=${mergedSince}`;
  const authors = new Set();
  const examinedPrIds = new Set();
  const expectedRepositoryApiUrl = `${API}/repos/${owner}/${name}`.toLowerCase();
  const windowDayStart = Date.parse(`${mergedSince}T00:00:00.000Z`);
  let totalMatches = null;
  let complete = true;
  let reviewedMatches = 0;
  let excludedBeforeExactWindow = 0;
  let pagesRead = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const path = `/search/issues?q=${encodeURIComponent(query)}&per_page=${PAGE_SIZE}&page=${page}`;
    const result = await readPublicJson(path, fetchImpl);
    if (!Array.isArray(result?.items) || !Number.isSafeInteger(result?.total_count) || result.total_count < 0) {
      throw new Error('GitHub search response missing required fields (evidence incomplete)');
    }
    if (totalMatches === null) totalMatches = result.total_count;
    if (result.incomplete_results !== false || result.total_count !== totalMatches) complete = false;
    pagesRead++;
    reviewedMatches += result.items.length;
    for (const item of result.items) {
      const match = typeof item?.html_url === 'string'
        ? /^https:\/\/github\.com\/([a-zA-Z\d-]+)\/([a-zA-Z\d_.-]+)\/pull\/([1-9]\d*)$/.exec(item.html_url)
        : null;
      const number = match ? Number(match[3]) : null;
      const mergedMillis = canonicalUtcMillis(item?.pull_request?.merged_at);
      const authorType = item?.user?.type;
      const login = item?.user?.login;
      // Search responses are untrusted discovery data. A result for a different
      // repository, invalid merge time or duplicate PR cannot prove adoption.
      if (!match || `${match[1]}/${match[2]}`.toLowerCase() !==
            `${owner}/${name}`.toLowerCase() ||
          (typeof item?.repository_url !== 'string' ||
           item.repository_url.toLowerCase() !== expectedRepositoryApiUrl) ||
          !Number.isSafeInteger(number) || number !== item?.number ||
          mergedMillis === null || mergedMillis > now.getTime() ||
          !['User', 'Bot'].includes(authorType) ||
          typeof login !== 'string' ||
          (authorType === 'User' && !/^[a-zA-Z\d](?:[a-zA-Z\d-]{0,37}[a-zA-Z\d])?$/.test(login))) {
        complete = false;
        continue;
      }
      const key = number;
      if (examinedPrIds.has(key)) {
        complete = false;
        continue;
      }
      examinedPrIds.add(key);
      if (mergedMillis < oneYearCutoff.getTime()) {
        if (mergedMillis >= windowDayStart) excludedBeforeExactWindow++;
        else complete = false;
        continue;
      }
      if (authorType === 'User' && login.toLowerCase() !== owner.toLowerCase()) {
        authors.add(login.toLowerCase());
      }
    }
    if (reviewedMatches >= totalMatches) break;
    if (result.items.length !== PAGE_SIZE) { complete = false; break; }
  }
  if (totalMatches > MAX_PAGES * PAGE_SIZE || reviewedMatches !== totalMatches) complete = false;

  return {
    repository: repository.full_name,
    snapshot_utc: now.toISOString(),
    repository_public: true,
    github_license_spdx: repository.license?.spdx_id ?? null,
    repo_created_at: repository.created_at ?? null,
    owner_account_type: ownerProfile?.type ?? null,
    owner_account_created_at: accountCreatedAt,
    owner_account_at_least_two_years_old: accountCreatedAt ? new Date(accountCreatedAt) <= twoYearCutoff : null,
    merged_pr_search: {
      since_utc_date: mergedSince,
      total_matches_reported: totalMatches,
      matches_examined: reviewedMatches,
      pages_read: pagesRead,
      excluded_before_exact_window: excludedBeforeExactWindow,
      complete,
      distinct_non_owner_human_authors_observed: authors.size,
      confirmed_distinct_non_owner_human_authors: complete ? authors.size : null,
      non_owner_author_logins: [...authors].sort(),
      caveat: 'Only canonical, non-duplicate, in-window merged PR hits for the requested repo contribute to the observed proxy. When complete=false the confirmed count is null. Non-owner authors may still be collaborators; review status manually.',
    },
    unverified: ['Package download counts', 'Dependent repositories/packages', 'OpenSSF criticality', 'Activity across all public repositories in the last 90 days', 'Formal Claude for OSS qualification'],
  };
}

async function main(args) {
  if (args.length !== 1) {
    console.error('Usage: node scripts/oss-community-evidence.mjs owner/repo');
    process.exitCode = 2;
    return;
  }
  try {
    console.log(JSON.stringify(await collectCommunityEvidence(args[0]), null, 2));
  } catch (error) {
    console.error(`Evidence collection failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2));
}
