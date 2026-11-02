import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  collectCommitChecks, buildCommitCheckReport, validateCommitTarget,
} from '../src/lib/nexus-commit-checks.mjs';

const repository = 'owner/example';
const sha = 'a'.repeat(40);
const json = (payload, status = 200, headers = {}) => new Response(JSON.stringify(payload), {
  status, headers: { 'Content-Type': 'application/json', ...headers },
});
const checks = {
  total_count: 3,
  check_runs: [
    { id: 1, name: 'Tests', status: 'completed', conclusion: 'failure', app: { slug: 'github-actions' } },
    { id: 2, name: 'Preview', status: 'completed', conclusion: 'success', app: { slug: 'vercel' } },
    { id: 3, name: 'Compile', status: 'in_progress', conclusion: null, app: { slug: 'github-actions' } },
  ],
};
const statuses = {
  statuses: [
    { context: 'ci/circleci: build', state: 'failure' },
    { context: 'ci/circleci: build', state: 'success' }, // older status should be ignored
    { context: 'some optional status', state: 'success' },
  ],
};

test('public GitHub Checks and CircleCI commit statuses form a bounded, read-only JARVIS report', async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/check-runs?')) return json(checks);
    if (url.includes('/status?')) return json(statuses);
    throw Error('unexpected URL');
  };
  const report = await collectCommitChecks({ repository, sha, fetcher, now: () => new Date('2026-11-02T15:30:00Z') });
  assert.equal(report.schema, 'nexus.devops.commit-checks/v1');
  assert.equal(report.generated_at_utc, '2026-11-02T15:30:00.000Z');
  assert.equal(report.coverage, 'both_sources');
  assert.equal(report.observed_state, 'failure_observed');
  assert.deepEqual(report.counts, { failure: 2, pending: 1, success: 2, other: 0 });
  assert.deepEqual(report.access, { mode: 'read_only', write_actions: [], paid_api_used: false });
  assert.equal(report.items.length, 5);
  assert.ok(report.items.some(i => i.provider === 'circleci' && i.outcome === 'failure'));
  assert.ok(report.items.some(i => i.provider === 'vercel' && i.outcome === 'success'));
  assert.ok(report.attention.every(i => i.source_url === 'https://github.com/owner/example/commit/' + sha + '/checks'));
  assert.equal(calls.length, 2);
  assert.ok(calls.every(c => c.url.startsWith('https://api.github.com/repos/owner/example/commits/' + sha)));
  assert.ok(calls.every(c => c.init.redirect === 'error' && !('Authorization' in c.init.headers)));
});

test('invalid targets are rejected before any network access', async () => {
  let count = 0;
  const fetcher = () => { count++; throw Error('should not fetch'); };
  for (const [repo, commit] of [
    ['no-slash', sha], ['../evil', sha], ['owner/repo/other', sha],
    [repository, 'main'], [repository, 'A'.repeat(40)], [repository, 'a'.repeat(39)],
  ]) {
    await assert.rejects(collectCommitChecks({ repository: repo, sha: commit, fetcher }));
    assert.throws(() => validateCommitTarget(repo, commit));
  }
  assert.equal(count, 0);
});

test('rate limited checks do not erase a verified CircleCI status', async () => {
  const result = await collectCommitChecks({
    repository, sha,
    fetcher: url => url.includes('/check-runs?') ? json({}, 429) : Promise.resolve(json(statuses)),
  });
  assert.equal(result.coverage, 'commit_statuses_only');
  assert.equal(result.sources.checks, 'rate_limited');
  assert.equal(result.counts.failure, 1);
});

test('completed skipped and cancelled checks are not treated as failures or pending', () => {
  const result = buildCommitCheckReport({
    repository, sha, checks: { state: 'verified', data: {
      total_count: 2, check_runs: [
        { id: 1, name: 'Skipped', status: 'completed', conclusion: 'skipped' },
        { id: 2, name: 'Cancelled', status: 'completed', conclusion: 'cancelled' },
      ],
    } }, statuses: { state: 'unavailable' },
  });
  assert.equal(result.counts.other, 2);
  assert.equal(result.counts.failure, 0);
  assert.equal(result.counts.pending, 0);
  assert.equal(result.observed_state, 'no_failure_in_sample');
});

test('one malformed source leaves verified data from the other source intact', async () => {
  const result = await collectCommitChecks({
    repository, sha,
    fetcher: url => Promise.resolve(url.includes('/check-runs?')
      ? json({ total_count: 'wrong', check_runs: [] }) : json(statuses)),
  });
  assert.equal(result.sources.checks, 'invalid');
  assert.equal(result.sources.commit_statuses, 'verified');
  assert.equal(result.counts.failure, 1);
});

test('oversized upstream JSON is rejected without assuming success', async () => {
  const result = await collectCommitChecks({
    repository, sha,
    fetcher: () => Promise.resolve(new Response('x'.repeat(2_100_000), {
      status: 200, headers: { 'content-type': 'application/json' },
    })),
  });
  assert.equal(result.coverage, 'none');
  assert.equal(result.sources.checks, 'invalid');
  assert.equal(result.counts.success, 0);
});

test('CLI invalid input returns exit 2 without attempting any GitHub call', () => {
  const result = spawnSync(process.execPath, ['scripts/jarvis-commit-checks.mjs', '--json', 'x/y', 'main'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /commit SHA/);
});

test('untrusted check names are sanitized and links are always GitHub commit links', () => {
  const result = buildCommitCheckReport({ repository, sha, checks: { state: 'verified', data: {
    total_count: 1, check_runs: [{ id: 42, name: 'CI\u202e\n' + 'x'.repeat(300), status: 'completed', conclusion: 'failure' }],
  } }, statuses: { state: 'unavailable' } });
  assert.equal(result.attention[0].name.includes('\u202e'), false);
  assert.equal(result.attention[0].name.includes('\n'), false);
  assert.ok(result.attention[0].name.length <= 160);
});


test('private GitHub token is opt-in, never used unless explicitly enabled', async () => {
  const seen = [];
  const fetcher = async (url, init) => {
    seen.push(init.headers.Authorization);
    return url.includes('/check-runs?') ? json(checks) : json(statuses);
  };
  await collectCommitChecks({ repository, sha, fetcher, token: 'ghp_example', allowToken: false });
  assert.deepEqual(seen, [undefined, undefined]);
  seen.length = 0;
  await collectCommitChecks({ repository, sha, fetcher, token: 'ghp_example', allowToken: true });
  assert.deepEqual(seen, ['Bearer ghp_example', 'Bearer ghp_example']);
  seen.length = 0;
  await collectCommitChecks({ repository, sha, fetcher, token: 'bad\nsecret', allowToken: true });
  assert.deepEqual(seen, [undefined, undefined], 'malformed token must not be forwarded');
});


test('approval-gated GitHub checks need action but are not failed test evidence', () => {
  const report = buildCommitCheckReport({
    repository, sha,
    checks: { state: 'verified', data: {
      total_count: 1,
      check_runs: [{
        id: 21, name: 'Test', status: 'completed', conclusion: 'action_required',
        app: { slug: 'github-actions' },
      }],
    } },
    statuses: { state: 'unavailable' },
  });
  assert.deepEqual(report.counts, { failure: 0, pending: 1, success: 0, other: 0 });
  assert.equal(report.observed_state, 'pending_observed');
  assert.equal(report.attention.length, 1);
  assert.equal(report.attention[0].reported_conclusion, 'action_required');
  assert.match(report.attention[0].inspection_hint, /approval|authorization|action/i);
  assert.equal(report.attention[0].outcome, 'pending');
});
