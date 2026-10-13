import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePublicRepository, summarizePublicActions } from '../src/lib/github-public-actions.ts';

const repo = 'example/repository';
const workflow = (id, conclusion = 'success') => ({
  id, name: 'CI', event: 'push', status: 'completed', conclusion,
  created_at: '2026-10-12T10:00:00Z',
  html_url: `https://github.com/${repo}/actions/runs/${id}`,
});

test('accepts safe owner/repo names and rejects unsafe inputs', () => {
  assert.deepEqual(parsePublicRepository(repo), ['example', 'repository']);
  for (const value of ['', '../x', 'example/..', 'example/repository?token=abc',
    'https://evil.example/x', 'a/b/c', null, 12]) {
    assert.throws(() => parsePublicRepository(value));
  }
});

test('counts only ten sampled workflow runs and preserves matching total', () => {
  const result = summarizePublicActions(repo, {
    total_count: 95,
    workflow_runs: Array.from({ length: 14 }, (_, i) => workflow(i + 1, i === 0 ? 'failure' : 'success')),
  });
  assert.equal(result.inspected_runs, 10);
  assert.equal(result.total_matching_runs, 95);
  assert.equal(result.failed_runs, 1);
  assert.equal(result.successful_runs, 9);
  assert.match(result.scope_note, /not billed minutes/);
});

test('rejects forged run URLs and corrupt payloads', () => {
  assert.throws(() => summarizePublicActions(repo, {
    total_count: 1,
    workflow_runs: [{ ...workflow(1), html_url: 'https://example.com/phishing' }],
  }));
  for (const payload of [null, {}, { total_count: -1, workflow_runs: [] },
    { total_count: 0, workflow_runs: 'bad' }]) {
    assert.throws(() => summarizePublicActions(repo, payload));
  }
});

test('rejects inconsistent totals, duplicate run IDs and invalid timestamps', () => {
  for (const data of [
    { total_count: 0, workflow_runs: [workflow(1)] },
    { total_count: 2, workflow_runs: [workflow(1), workflow(1)] },
    { total_count: 1, workflow_runs: [{ ...workflow(1), created_at: 'not-a-date' }] },
    { total_count: 1, workflow_runs: [workflow(0)] },
  ]) assert.throws(() => summarizePublicActions(repo, data));
});

test('completed cancelled, skipped and neutral outcomes are not pending runs', () => {
  const items = [
    workflow(1, 'success'), workflow(2, 'failure'), workflow(3, 'timed_out'),
    workflow(4, 'startup_failure'), workflow(5, 'cancelled'), workflow(6, 'skipped'),
    workflow(7, 'neutral'), { ...workflow(8, null), status: 'queued' },
    { ...workflow(9, null), status: 'in_progress' },
    { ...workflow(10, null), status: 'waiting' },
  ];
  const result = summarizePublicActions(repo, { total_count: 10, workflow_runs: items });
  assert.equal(result.inspected_runs, 10);
  assert.equal(result.successful_runs, 1);
  assert.equal(result.failed_runs, 3);
  assert.equal(result.pending_runs, 3);
  assert.equal(result.other_outcome_runs, 3);
  assert.equal(result.successful_runs + result.failed_runs + result.pending_runs +
    result.other_outcome_runs, result.inspected_runs);
});

test('completed runs without a conclusion are unknown outcomes, not pending', () => {
  const r = summarizePublicActions(repo, {
    total_count: 2,
    workflow_runs: [workflow(1, null), { ...workflow(2, null), status: 'requested' }],
  });
  assert.equal(r.pending_runs, 1);
  assert.equal(r.other_outcome_runs, 1);
  assert.equal(r.failed_runs, 0);
});
