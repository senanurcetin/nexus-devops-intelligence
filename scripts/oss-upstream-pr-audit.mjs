#!/usr/bin/env node
// Inspect merged upstream PRs; never count open or self-owned PRs.
import { pathToFileURL } from 'node:url';

const API = 'https://api.github.com';
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export function validateLogin(login) {
  if (typeof login !== 'string' || !/^[a-zA-Z\d](?:[a-zA-Z\d-]{0,37}[a-zA-Z\d])?$/.test(login)) {
    throw new Error('GitHub username must have 1–39 characters (letters, digits or interior hyphens)');
  }
  return login;
}

function yearAgo(now) {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function repoFromApiUrl(url) {
  if (typeof url !== 'string') return null;
  const match = /^https:\/\/api\.github\.com\/repos\/([a-zA-Z\d-]{1,39})\/([a-zA-Z\d_.-]+)$/.exec(url);
  return match ? `${match[1]}/${match[2]}` : null;
}

/** GitHub REST uses UTC RFC3339 seconds (optionally three-digit milliseconds).
 * Reject impossible calendar days, timezone reinterpretation and Date.parse rollovers.
 */
function parseCanonicalMergedAt(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) return null;
  const iso = new Date(epoch).toISOString();
  return value === iso || value === iso.replace(/\.000Z$/, 'Z') ? epoch : null;
}

async function searchPages(login, state, cutoff, fetchImpl, exactWindow = null) {
  const qualifier = state === 'merged' ? `is:merged merged:>=${cutoff}` : 'is:open';
  const query = `author:${login} is:pr ${qualifier} -user:${login}`;
  const observed = new Map();
  let totalCount = null;
  let seenRows = 0;
  let complete = true;
  let pagesRead = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${API}/search/issues?q=${encodeURIComponent(query)}&per_page=${PAGE_SIZE}&page=${page}`;
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'nexus-oss-upstream-audit/1.0', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response?.ok) throw new Error(`GitHub search returned HTTP ${response?.status ?? 'unknown'}; ${state} count not verified`);
    const result = await response.json();
    if (!Array.isArray(result?.items) || !Number.isSafeInteger(result?.total_count) || result.total_count < 0) {
      throw new Error('Malformed GitHub search response; count not verified');
    }
    pagesRead++;
    if (totalCount === null) totalCount = result.total_count;
    if (result.total_count !== totalCount || result.incomplete_results !== false) complete = false;
    seenRows += result.items.length;
    for (const item of result.items) {
      const repo = repoFromApiUrl(item?.repository_url);
      const url = item?.html_url;
      const match = typeof url === 'string' ? /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)$/.exec(url) : null;
      const mergedEpoch = state === 'merged' ? parseCanonicalMergedAt(item?.pull_request?.merged_at) : null;
      if (!repo || !match || repo.toLowerCase() !== `${match[1]}/${match[2]}`.toLowerCase() ||
          match[1].toLowerCase() === login.toLowerCase() ||
          item?.user?.login?.toLowerCase() !== login.toLowerCase() ||
          !item?.pull_request ||
          (state === 'merged' && (
            mergedEpoch === null ||
            mergedEpoch < exactWindow.start ||
            mergedEpoch > exactWindow.end
          ))) {
        complete = false;
        continue;
      }
      observed.set(url, {
        repository: repo,
        number: Number(match[3]),
        url,
        title: typeof item.title === 'string' ? item.title : '',
        ...(state === 'merged' ? { merged_at: item.pull_request.merged_at } : {}),
      });
    }
    if (seenRows >= totalCount) break;
    if (result.items.length !== PAGE_SIZE) { complete = false; break; }
  }
  if (totalCount > MAX_PAGES * PAGE_SIZE || seenRows !== totalCount || observed.size !== seenRows) complete = false;
  return {
    github_reported_matches: totalCount,
    observed_valid_external_prs: observed.size,
    confirmed_count: complete ? observed.size : null,
    complete,
    pages_read: pagesRead,
    prs: [...observed.values()].sort((a, b) => a.repository.localeCompare(b.repository) || a.number - b.number),
  };
}

export async function auditUpstreamPRs(login, { fetchImpl = fetch, now = new Date() } = {}) {
  validateLogin(login);
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Invalid snapshot date');
  const cutoff = yearAgo(now);
  const exactStart = new Date(now);
  exactStart.setUTCFullYear(exactStart.getUTCFullYear() - 1);
  const merged = await searchPages(login, 'merged', cutoff, fetchImpl, {
    start: exactStart.getTime(), end: now.getTime(),
  });
  const open = await searchPages(login, 'open', cutoff, fetchImpl);
  return {
    github_user: login,
    snapshot_utc: now.toISOString(),
    merged_since_utc_date: cutoff,
    merged_since_utc_timestamp: exactStart.toISOString(),
    merged_in_other_owners_repositories: merged,
    open_in_other_owners_repositories: open,
    caution: 'GitHub search is a discovery snapshot, not Anthropic approval. Open PRs never count. Verify merge dates, authorship, repository ownership, substantive contribution and program terms before submission.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) {
    console.error('Usage: node scripts/oss-upstream-pr-audit.mjs GITHUB_LOGIN');
    process.exitCode = 2;
  } else {
    try {
      console.log(JSON.stringify(await auditUpstreamPRs(process.argv[2]), null, 2));
    } catch (error) {
      console.error(`Upstream PR audit failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      process.exitCode = 1;
    }
  }
}
