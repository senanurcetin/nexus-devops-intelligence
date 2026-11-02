import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePublicActions } from '../src/lib/github-public-actions.ts';
import { summarizePublicPullRequests } from '../src/lib/nexus-public-prs.ts';
import { isPublicActionsSample, isPublicPullSample } from '../src/lib/nexus-panel-validation.ts';

const repo = 'example/timestamp-contract';
const action = created_at => ({
  id: 7, name: 'CI', event: 'push', status: 'completed', conclusion: 'success',
  created_at, html_url: `https://github.com/${repo}/actions/runs/7`,
});
const pull = updated_at => ({
  number: 8, title: 'Safe public PR', draft: false,
  updated_at, html_url: `https://github.com/${repo}/pull/8`,
  user: { login: 'contributor' },
});

test('GitHub Actions producer rejects ambiguous, impossible and non-UTC run times', () => {
  for (const invalid of [
    '1', '2026-02-30T12:00:00Z', '2026-11-02T24:00:00Z',
    '2026-11-02T12:00:00+00:00', '2026-11-02T12:00:00',
    '2026-13-02T12:00:00Z', '2026-11-02T12:00:60Z',
  ]) {
    assert.throws(
      () => summarizePublicActions(repo, { total_count: 1, workflow_runs: [action(invalid)] }),
      /Invalid workflow run/, `${invalid} must not pass the Actions producer`,
    );
  }
});

test('GitHub PR producer rejects ambiguous, impossible and non-UTC update times', () => {
  for (const invalid of [
    '1', '2026-02-30T12:00:00Z', '2026-11-02T24:00:00Z',
    '2026-11-02T12:00:00+00:00', '2026-11-02T12:00:00',
    '2026-13-02T12:00:00Z', '2026-11-02T12:00:60Z',
  ]) {
    assert.throws(
      () => summarizePublicPullRequests(repo, [pull(invalid)], [null]),
      /Invalid GitHub pull request/, `${invalid} must not pass the PR producer`,
    );
  }
});

test('producer and browser validator agree on valid UTC dates and precision', () => {
  for (const valid of [
    '2026-11-02T12:00:00Z', '2026-11-02T12:00:00.123Z',
    '2026-11-02T12:00:00.123456789Z', '2024-02-29T23:59:59Z',
  ]) {
    const actions = summarizePublicActions(repo, {
      total_count: 1, workflow_runs: [action(valid)],
    });
    const pulls = summarizePublicPullRequests(repo, [pull(valid)], [null]);
    assert.equal(isPublicActionsSample(actions, repo), true, valid);
    assert.equal(isPublicPullSample(pulls, repo), true, valid);
    assert.equal(actions.runs[0].created_at, valid);
    assert.equal(pulls.pull_requests[0].updated_at, valid);
  }
});

test('browser validator continues to reject tampered timestamps for both samples', () => {
  const actions = summarizePublicActions(repo, {
    total_count: 1, workflow_runs: [action('2026-11-02T12:00:00Z')],
  });
  const pulls = summarizePublicPullRequests(repo,
    [pull('2026-11-02T12:00:00Z')], [null]);
  actions.runs[0].created_at = '2026-02-30T12:00:00Z';
  pulls.pull_requests[0].updated_at = '1';
  assert.equal(isPublicActionsSample(actions, repo), false);
  assert.equal(isPublicPullSample(pulls, repo), false);
});
