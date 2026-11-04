import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isPublicCommitChecks } from '../src/lib/nexus-commit-checks-guard.ts';
import { buildCommitCheckReport } from '../src/lib/nexus-commit-checks.mjs';
import { readPublicPanel } from '../src/lib/nexus-panel-request.ts';

const repo = 'owner/example';
const sha = 'a'.repeat(40);
const report = () => JSON.parse(JSON.stringify(buildCommitCheckReport({
  repository: repo, sha,
  checks: { state: 'verified', data: { total_count: 1, check_runs: [
    { id: 1, head_sha: sha, name: 'Tests', status: 'completed', conclusion: 'failure', app: { slug: 'github-actions' } }] } },
  statuses: { state: 'verified', data: { sha, total_count: 1, statuses: [{ context: 'ci/x', state: 'success' }] } },
  now: new Date('2026-11-04T00:00:00Z'),
})));

test('guard accepts a real collector report and normalizes SHA case', () => {
  assert.equal(isPublicCommitChecks(report(), repo, sha), true);
  assert.equal(isPublicCommitChecks(report(), repo, sha.toUpperCase()), true);
});

test('guard rejects cross-repository, cross-commit and tampered payloads', () => {
  const mutations = [
    r => { r.repository = 'other/repo'; },
    r => { r.commit_sha = 'b'.repeat(40); },
    r => { r.schema = 'x'; },
    r => { r.counts.failure = 9; },
    r => { r.items[0].source_url = 'https://evil.example/x'; },
    r => { r.items[0].outcome = 'bogus'; },
    r => { r.sources.checks = 'maybe'; },
    r => { r.coverage = 'all'; },
    r => { r.items.pop(); },
    r => { r.truncated = null; },
    r => { r.limitations = [1]; },
  ];
  for (const mutate of mutations) {
    const r = report(); mutate(r);
    assert.equal(isPublicCommitChecks(r, repo, sha), false);
  }
  assert.equal(isPublicCommitChecks(null, repo, sha), false);
  assert.equal(isPublicCommitChecks(report(), 'bad', sha), false);
});

test('route error messages are on the browser allowlist', async () => {
  for (const [status, error] of [
    [400, 'Use a valid public repository and full commit SHA.'],
    [404, 'Commit or repository was not found.'],
    [404, 'Commit checks are not enabled on this deployment.'],
    [429, 'GitHub rate limit reached. Please retry later.'],
    [502, 'GitHub commit check data could not be verified.'],
  ]) {
    const fetcher = async () => new Response(JSON.stringify({ error }), { status });
    const panel = await readPublicPanel('/x', new AbortController().signal, fetcher);
    if (status !== 429) assert.equal(panel.error, error);
    else assert.match(panel.error, /Request limit reached/);
  }
});

test('page wires the button on demand only, from loaded PR evidence', () => {
  const page = readFileSync('src/app/page.tsx', 'utf8');
  assert.match(page, /\/api\/public-commit-checks\?/);
  // the fetch lives only inside the click handler, never an effect
  const handler = page.slice(page.indexOf('function inspectCommitChecks'), page.indexOf('async function copyEvidenceLink'));
  assert.match(handler, /prEvidence\.data\?\.head_sha/);
  assert.match(handler, /prEvidenceKey !== selectedRepo/);
  const before = page.slice(0, page.indexOf('function inspectCommitChecks'));
  assert.equal(before.includes('/api/public-commit-checks'), false);
  assert.match(page, /onClick=\{\(\) => inspectCommitChecks\(pr\.number\)\}/);
});
