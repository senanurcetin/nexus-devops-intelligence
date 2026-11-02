import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectWorkflowSteps, validateWorkflowTarget } from '../src/lib/nexus-jarvis-workflow-steps.mjs';

const repository = 'owner/example';
const sha = 'a'.repeat(40);
const runId = 333222;
const run = {
  id: runId, head_sha: sha, run_attempt: 2,
  html_url: 'https://github.com/owner/example/actions/runs/' + runId,
  status: 'completed', conclusion: 'failure',
};
const steps = [
  { number: 1, name: 'Install dependencies', status: 'completed', conclusion: 'success' },
  { number: 2, name: 'Run tests', status: 'completed', conclusion: 'failure' },
];
const jobs = { total_count: 1, jobs: [{
  id: 4001, run_id: runId, run_attempt: 2,
  name: 'quality', status: 'completed', conclusion: 'failure', steps,
}] };
function transportFor(runData = run, jobsData = jobs, requests = []) {
  return async (url, options) => {
    requests.push({ url, options });
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, undefined);
    assert.ok(url.startsWith('https://api.github.com/repos/owner/example/actions/runs/' + runId));
    return Response.json(url.includes('/attempts/') ? jobsData : runData);
  };
}
const collect = (transport, extra = {}) => collectWorkflowSteps({
  repository, sha, runId, transport,
  now: () => new Date('2026-11-02T12:00:00.000Z'), ...extra,
});

test('reuses exact failed run and attempt with only two read-only GETs', async () => {
  const requests = [];
  const result = await collect(transportFor(run, jobs, requests));
  assert.equal(result.ok, true);
  assert.equal(result.schema, 'nexus.devops.workflow-steps/v1');
  assert.equal(result.commit_sha, sha);
  assert.equal(result.run_attempt, 2);
  assert.equal(result.jobs[0].steps[1].conclusion, 'failure');
  assert.equal(result.coverage, 'github_actions_failed_run_jobs_only');
  assert.equal(result.access.authentication_used, false);
  assert.equal(result.access.paid_api_used, false);
  assert.equal(result.truncated.jobs, false);
  assert.equal(requests.length, 2);
  assert.match(requests[1].url, /attempts\/2\/jobs\?per_page=20&page=1$/);
});

test('wrong commit stops before jobs endpoint even if run identity otherwise valid', async () => {
  const calls = [];
  const result = await collect(transportFor({ ...run, head_sha: 'b'.repeat(40) }, jobs, calls));
  assert.equal(result.ok, false);
  assert.equal(result.state, 'identity_mismatch');
  assert.equal(calls.length, 1);
});

test('unverified or nonfailed workflow never proceeds to jobs', async () => {
  for (const invalid of [{ ...run, conclusion: 'success' }, { ...run, id: 999 }, { ...run, status: 'in_progress' }]) {
    const calls = [];
    const response = await collect(transportFor(invalid, jobs, calls));
    assert.equal(response.ok, false);
    assert.equal(calls.length, 1);
  }
});

test('truncation is explicit and no more than ten steps per job are output', async () => {
  const longSteps = Array.from({ length: 13 }, (_, i) => ({
    number: i + 1, name: 'step ' + (i + 1), status: 'completed', conclusion: 'failure',
  }));
  const longJobs = { total_count: 50, jobs: [{ ...jobs.jobs[0], steps: longSteps }] };
  const result = await collect(transportFor(run, longJobs));
  assert.equal(result.ok, true);
  assert.equal(result.jobs[0].steps.length, 10);
  assert.equal(result.truncated.jobs, true);
  assert.equal(result.truncated.steps, true);
});

test('credentials in third-party step names never reach the model', async () => {
  const credential = 'ghp_' + 'r'.repeat(40);
  const poisoned = { total_count: 1, jobs: [{
    ...jobs.jobs[0], name: 'quality ' + credential,
    steps: [{ ...steps[1], name: 'failed ' + credential }],
  }] };
  const result = await collect(transportFor(run, poisoned));
  assert.equal(result.ok, true);
  assert.equal(result.jobs[0].name, '[redacted: possible credential]');
  assert.equal(result.jobs[0].steps[0].name, '[redacted: possible credential]');
  assert.equal(JSON.stringify(result).includes(credential), false);
});

test('malformed jobs, mismatched attempt, excessive pages and expired GitHub quota fail closed', async () => {
  for (const invalid of [
    { ...jobs, jobs: [{ ...jobs.jobs[0], run_attempt: 3 }] },
    { ...jobs, total_count: 20, jobs: Array.from({ length: 21 }, (_, i) => ({ ...jobs.jobs[0], id: i + 1 })) },
    { ...jobs, jobs: [{ ...jobs.jobs[0], steps: [{ ...steps[0], number: 0 }] }] },
  ]) {
    const result = await collect(transportFor(run, invalid));
    assert.equal(result.ok, false);
  }
  const calls = [];
  const limited = await collect(async (url, opts) => {
    calls.push(url);
    return calls.length === 1 ? Response.json(run) : Response.json({ message: 'rate limited' }, { status: 429 });
  });
  assert.deepEqual(limited, { ok: false, state: 'rate_limited' });
});

test('oversized response and unsafe URL from a substituted loader are not ingested', async () => {
  const tooLarge = await collect(async () =>
    new Response(JSON.stringify({ ...run, extra: 'x'.repeat(1_000_000) }), {
      headers: { 'Content-Type': 'application/json' },
    }));
  assert.equal(tooLarge.ok, false);
  assert.equal(tooLarge.state, 'unavailable');
  let requests = 0;
  const unsafe = await collect(async () => { requests++; throw new Error('should never fetch external host'); }, {
    loader: async (repo, id, fetcher) => {
      await fetcher('https://evil.invalid/repos/owner/example/actions/runs/' + id);
      return { status: 200, body: {} };
    },
  });
  assert.equal(unsafe.ok, false);
  assert.equal(requests, 0);
});

test('refuses malformed targets before any network read', async () => {
  for (const id of [0, -1, 'main', '3x', 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validateWorkflowTarget(repository, sha, id));
  }
  assert.throws(() => validateWorkflowTarget('owner/../repo', sha, 100));
  assert.throws(() => validateWorkflowTarget(repository, 'main', 100));
});

test('CLI invalid input exits with code 2 independent of current working directory', () => {
  const script = fileURLToPath(new URL('../scripts/jarvis-workflow-steps.mjs', import.meta.url));
  const result = spawnSync(process.execPath, ['--import', 'tsx', script, '--json', repository, sha, 'bad'], {
    encoding: 'utf8', cwd: process.cwd(),
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /workflow run identifier/i);
});
