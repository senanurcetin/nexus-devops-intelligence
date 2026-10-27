import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicSampleExport } from '../src/lib/nexus-public-sample-export.ts';
import { createAuditBrief, createAuditBriefFilename } from '../src/lib/nexus-audit-brief.ts';

const repo = 'owner/repository';
const received = '2026-10-15T10:20:00.000Z';
const run = (id, name = 'Compile') => ({
  id, name, status: 'completed', conclusion: 'failure', event: 'push',
  created_at: received, html_url: 'https://github.com/' + repo + '/actions/runs/' + id,
});
const pr = (number, title = 'Triage') => ({
  number, title, author: 'dev', updated_at: received, attention: 'unknown',
  explanation: 'Not yet verified',
  html_url: 'https://github.com/' + repo + '/pull/' + number,
});
const actions = {
  repository: repo, total_matching_runs: 50, inspected_runs: 1,
  successful_runs: 0, failed_runs: 1, pending_runs: 0, other_outcome_runs: 0,
  scope_note: 'Recent sample only', runs: [run(11)],
};
const pulls = {
  repository: repo, inspected_prs: 1, more_open_prs: true,
  conflicts: 0, needs_attention: 1, unknown: 1,
  scope_note: 'Limited sample', pull_requests: [pr(7)],
};
const snapshot = (changes = {}) => createPublicSampleExport({
  repository: repo, actions, prs: pulls,
  actionsReceivedAt: received, prsReceivedAt: received,
  workflowFilter: 'all', pullFilter: 'all',
  exportedAt: '2026-10-15T10:24:00.000Z', ...changes,
});

test('Audit brief: deterministic provenance and bounded source-linked handoff', () => {
  const source = snapshot();
  const first = createAuditBrief(source);
  assert.equal(first, createAuditBrief(source));
  assert.match(first, /Inspected: 1 of 50 matching runs/);
  assert.match(first, /Included after filter: 1/);
  assert.match(first, /More open PRs indicated by source: yes/);
  assert.match(first, /https:\/\/github.com\/owner\/repository\/actions\/runs\/11/);
  assert.match(first, /https:\/\/github.com\/owner\/repository\/pull\/7/);
  assert.match(first, /Not established by this bounded sample/);
  assert.equal(createAuditBriefFilename(source),
    'nexus-owner-repository-sample-20261015102400-utc-audit-brief.md');
});

test('Audit brief: unavailable independent sources are not silently passed', () => {
  const onlyPulls = createAuditBrief(snapshot({ actions: null, actionsReceivedAt: null }));
  assert.match(onlyPulls, /Source unavailable or unverified\. No workflow assessment\./);
  assert.doesNotMatch(onlyPulls, /Inspected workflow evidence/);
  const onlyActions = createAuditBrief(snapshot({ prs: null, prsReceivedAt: null }));
  assert.match(onlyActions, /Source unavailable or unverified\. No PR assessment\./);
});

test('Audit brief: visible filters cannot masquerade as full coverage', () => {
  const filtered = createAuditBrief(snapshot({
    workflowFilter: 'success', pullFilter: 'conflict',
  }));
  assert.match(filtered, /Applied workflow filter: success/);
  assert.match(filtered, /Included after filter: 0/);
  assert.match(filtered, /No workflow rows match the current export filter/);
  assert.match(filtered, /No PR rows match the current export filter/);
  assert.doesNotMatch(filtered, /\[Run #11\]/);
});

test('Audit brief: hostile PR titles are neutralized and URLs must be canonical', () => {
  const dangerous = snapshot({
    actions: { ...actions, runs: [run(11, 'Build\n# forged header')] },
    prs: { ...pulls, pull_requests: [
      pr(7, 'Fix ](https://evil.example)\n## Approved\u202e'),
    ] },
  });
  const report = createAuditBrief(dangerous);
  assert.doesNotMatch(report, /\n## Approved/);
  assert.doesNotMatch(report, /\]\(https:\/\/evil\.example\)/);
  assert.match(report, /forged header/);
  const tampered = structuredClone(dangerous);
  tampered.pull_requests.records[0].html_url = 'https://evil.example';
  assert.throws(() => createAuditBrief(tampered), /Unexpected PR source URL/);
  assert.throws(() => createAuditBriefFilename(tampered), /Unexpected PR source URL/);
});

test('Audit brief: rejects inconsistent manually provided snapshot', () => {
  const source = snapshot();
  const tampered = structuredClone(source);
  tampered.actions.exported_runs = 10;
  assert.throws(() => createAuditBrief(tampered), /Inconsistent workflow sample/);
  assert.throws(() => createAuditBrief({ ...source, actions: null, pull_requests: null }));
});
