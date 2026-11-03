// Zero-cost, read-only GitHub commit-check collector for NEXUS JARVIS.
// Includes GitHub Checks (GitHub Actions / installed apps) and legacy commit statuses
// (CircleCI publishes these by default). Anonymous by default; optional GitHub token
// for private repositories is used only with NEXUS_DEVOPS_ALLOW_GITHUB_TOKEN=1.
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const MAX_BYTES = 2_000_000;
const MAX_ITEMS = 100;

export function validateCommitTarget(repository, sha) {
  if (typeof repository !== 'string' || repository.length > 200 || !REPOSITORY.test(repository) ||
      repository.split('/').some(p => p === '.' || p === '..' || p.length > 100) ||
      typeof sha !== 'string' || !SHA.test(sha)) {
    throw new Error('Expected a public owner/repository and lowercase 40- or 64-character commit SHA.');
  }
  return { repository, sha };
}

function clean(value, limit = 160) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, limit);
}

function providerOf(value) {
  const s = clean(value, 160).toLowerCase();
  if (s.includes('circleci')) return 'circleci';
  if (s.includes('vercel')) return 'vercel';
  if (s.includes('github-actions') || s.includes('github actions') || s.includes('actions/')) return 'github-actions';
  return 'other';
}

function outcomeOfCheck(status, conclusion) {
  // A completed check requiring human approval has not failed its tests.
  // Keep it in the actionable/pending bucket, with the original conclusion.
  if (conclusion === 'action_required') return 'pending';
  if (status !== 'completed') return 'pending';
  if (['failure', 'timed_out', 'startup_failure'].includes(conclusion)) return 'failure';
  if (conclusion === 'success') return 'success';
  return 'other';
}

function inspectionHint(name) {
  const text = name.toLowerCase();
  if (/install|dependenc|npm ci|pnpm|yarn/.test(text)) return 'Inspect dependency installation and lockfile output in the original job logs.';
  if (/typescript|typecheck|tsc|lint/.test(text)) return 'Inspect the first type or lint error and its file and line in the original job logs.';
  if (/test|jest|vitest|pytest|playwright/.test(text)) return 'Open the failing test output and reproduce that specific case before editing.';
  if (/build|compile|bundle/.test(text)) return 'Inspect the first build or compilation error, runtime and environment variables.';
  if (/deploy|vercel|publish|release/.test(text)) return 'Inspect the deployment provider details and build log; do not retry or promote automatically.';
  return 'Open the original check or commit-status details; this summary does not include logs.';
}

function checkedInput(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export function buildCommitCheckReport({ repository, sha, checks, statuses, now = new Date() }) {
  validateCommitTarget(repository, sha);
  const sources = { checks: checks?.state ?? 'unavailable', commit_statuses: statuses?.state ?? 'unavailable' };
  const verifiedChecks = sources.checks === 'verified';
  const verifiedStatuses = sources.commit_statuses === 'verified';
  const items = [];
  const url = 'https://github.com/' + repository + '/commit/' + sha + '/checks';
  let checksTruncated = false;
  let statusesTruncated = false;
  if (verifiedChecks) {
    const data = checks.data;
    if (!checkedInput(data) || !Number.isSafeInteger(data.total_count) || data.total_count < 0 ||
        !Array.isArray(data.check_runs) ||
        data.total_count < data.check_runs.length) throw new Error('Invalid GitHub checks response.');
    // Every real GitHub check run has its own immutable head_sha; without it
    // the run could belong to a different commit despite a valid response URL.
    checksTruncated = data.total_count > Math.min(MAX_ITEMS, data.check_runs.length);
    const ids = new Set();
    for (const run of data.check_runs.slice(0, MAX_ITEMS)) {
      if (!checkedInput(run) || !Number.isSafeInteger(run.id) || run.id < 1 || ids.has(run.id) ||
          run.head_sha !== sha ||
          typeof run.name !== 'string' || typeof run.status !== 'string' ||
          !(run.conclusion === null || typeof run.conclusion === 'string')) {
        throw new Error('Invalid GitHub check run.');
      }
      ids.add(run.id);
      const name = clean(run.name);
      const provider = providerOf(run.app?.slug || name);
      items.push({
        kind: 'check_run', id: run.id, provider, name, outcome: outcomeOfCheck(run.status, run.conclusion),
        reported_status: clean(run.status, 32), reported_conclusion: clean(run.conclusion, 32) || null,
        source_url: url,
        inspection_hint: run.conclusion === 'action_required'
          ? 'This check needs maintainer approval or another manual action; inspect GitHub before rerunning. No test failure is confirmed.'
          : inspectionHint(name),
      });
    }
  }
  if (verifiedStatuses) {
    const data = statuses.data;
    // The combined status resource identifies the commit independently of the
    // requested URL. Do not report a cached/proxied response for another SHA
    // as evidence about the requested commit.
    if (!checkedInput(data) || data.sha !== sha ||
        !Number.isSafeInteger(data.total_count) || data.total_count < 0 ||
        !Array.isArray(data.statuses) || data.total_count < data.statuses.length) {
      throw new Error('Invalid GitHub commit status response.');
    }
    statusesTruncated = data.total_count > Math.min(MAX_ITEMS, data.statuses.length);
    // GitHub sends statuses newest first; retain only the newest state of each context.
    const contexts = new Set();
    for (const status of data.statuses.slice(0, MAX_ITEMS)) {
      if (!checkedInput(status) || typeof status.context !== 'string' ||
          !['success', 'pending', 'error', 'failure'].includes(status.state)) {
        throw new Error('Invalid GitHub status context.');
      }
      const name = clean(status.context);
      if (!name || contexts.has(name.toLowerCase())) continue;
      contexts.add(name.toLowerCase());
      items.push({
        kind: 'commit_status', provider: providerOf(name), name,
        outcome: status.state === 'error' || status.state === 'failure' ? 'failure' : status.state,
        reported_status: status.state, reported_conclusion: null, source_url: url,
        inspection_hint: inspectionHint(name),
      });
    }
  }
  const counts = { failure: 0, pending: 0, success: 0, other: 0 };
  for (const item of items) counts[item.outcome] += 1;
  const attention = items.filter(item => item.outcome === 'failure' || item.outcome === 'pending')
    .sort((a, b) => Number(b.outcome === 'failure') - Number(a.outcome === 'failure'))
    .slice(0, 20);
  const coverage = verifiedChecks && verifiedStatuses ? 'both_sources' :
    verifiedChecks ? 'checks_only' : verifiedStatuses ? 'commit_statuses_only' : 'none';
  return {
    schema: 'nexus.devops.commit-checks/v1',
    generated_at_utc: now.toISOString(), repository, commit_sha: sha,
    access: { mode: 'read_only', write_actions: [], paid_api_used: false },
    sources, coverage, sampled_records: items.length,
    truncated: { checks: checksTruncated, commit_statuses: statusesTruncated },
    counts, observed_state: counts.failure ? 'failure_observed' :
      counts.pending ? 'pending_observed' : items.length ? 'no_failure_in_sample' : 'no_records_in_sample',
    items, attention,
    limitations: [
      'Only checks and commit statuses reported to GitHub are visible; provider-native pipeline history is not queried.',
      'Records are observations, not unique pipelines; the same job may appear in both APIs.',
      'No logs or check annotations were read; inspection hints are not verified root-cause diagnoses.',
      'An action_required check is awaiting manual intervention, not evidence of failing tests.',
      'A missing or incomplete source does not establish that CI passed or that deployment is ready.',
    ],
  };
}

async function githubJson(fetcher, url, authorization) {
  try {
    const response = await fetcher(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'nexus-devops-jarvis-commit-checks',
        ...(authorization ? { Authorization: 'Bearer ' + authorization } : {}),
      },
      redirect: 'error', signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 403 || response.status === 429) return { state: 'rate_limited' };
    if (response.status === 404) return { state: 'not_found' };
    if (!response.ok) return { state: 'unavailable' };
    if (!/application\/json/i.test(response.headers.get('content-type') ?? '')) return { state: 'invalid' };
    if (Number(response.headers.get('content-length')) > MAX_BYTES) {
      await response.body?.cancel();
      return { state: 'invalid' };
    }
    if (!response.body) return { state: 'invalid' };
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return { state: 'invalid' };
      }
      chunks.push(value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!checkedInput(data)) return { state: 'invalid' };
    return { state: 'verified', data };
  } catch {
    return { state: 'unavailable' };
  }
}

export async function collectCommitChecks({
  repository, sha, fetcher = fetch, now = () => new Date(),
  token = process.env.NEXUS_GITHUB_TOKEN,
  allowToken = process.env.NEXUS_DEVOPS_ALLOW_GITHUB_TOKEN === '1',
}) {
  validateCommitTarget(repository, sha); // Reject invalid inputs before any HTTP call.
  // Credentials never leave api.github.com and are never sent without an opt-in.
  const authToken = allowToken && typeof token === 'string' && token.length > 0 &&
    token.length <= 500 && !/[\r\n]/.test(token) ? token : null;
  const base = 'https://api.github.com/repos/' + repository + '/commits/' + sha;
  const [checks, statuses] = await Promise.all([
    githubJson(fetcher, base + '/check-runs?per_page=100&page=1', authToken),
    githubJson(fetcher, base + '/status?per_page=100&page=1', authToken),
  ]);
  // Validate each independent provider surface separately; one malformed response
  // must not erase the other source's correctly verified evidence.
  let safeChecks = checks;
  let safeStatuses = statuses;
  try {
    buildCommitCheckReport({ repository, sha, checks, statuses: { state: 'unavailable' }, now: now() });
  } catch {
    safeChecks = { state: 'invalid' };
  }
  try {
    buildCommitCheckReport({ repository, sha, checks: { state: 'unavailable' }, statuses, now: now() });
  } catch {
    safeStatuses = { state: 'invalid' };
  }
  return buildCommitCheckReport({
    repository, sha, checks: safeChecks, statuses: safeStatuses, now: now(),
  });
}
