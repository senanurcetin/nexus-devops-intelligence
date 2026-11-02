import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJarvisDigest } from '../src/lib/nexus-jarvis-digest.ts';
import { summarizePublicActions } from '../src/lib/github-public-actions.ts';

const repository = 'owner/repo';
const now = new Date('2026-11-02T12:15:00.000Z');
const actions = summarizePublicActions(repository, {
  total_count: 1,
  workflow_runs: [{
    id: 7, name: 'CI', event: 'push', status: 'completed',
    conclusion: 'failure', created_at: '2026-11-02T12:00:00.000Z',
    html_url: 'https://github.com/owner/repo/actions/runs/7',
  }],
});

const digestAt = receivedAtUtc => buildJarvisDigest({
  repository, now, pullRequests: null,
  actions: { status: 200, body: actions, receivedAtUtc },
});

test('a future source receipt cannot yield a verified digest or source-backed findings', () => {
  const report = digestAt('2026-11-02T12:16:00.001Z');
  assert.equal(report.sources.actions.state, 'invalid');
  assert.equal(report.sources.actions.http_status, 200);
  assert.equal(report.sources.actions.received_at_utc, null);
  assert.equal(report.posture.coverage, 'none');
  assert.equal(report.posture.state, 'await_evidence');
  assert.deepEqual(report.investigations, []);
  assert.equal(report.handoff_markdown, null);
});

test('a source receipt exactly one minute ahead retains the documented clock-skew allowance', () => {
  const report = digestAt('2026-11-02T12:16:00.000Z');
  assert.equal(report.sources.actions.state, 'verified');
  assert.equal(report.posture.coverage, 'actions_only');
  assert.equal(report.posture.workflow.freshness, 'recent');
  assert.equal(report.posture.state, 'investigate_observed');
  assert.equal(report.investigations.length, 1);
  assert.equal(report.investigations[0].source_url,
    'https://github.com/owner/repo/actions/runs/7');
});
