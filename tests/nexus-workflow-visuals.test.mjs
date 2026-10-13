import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePublicActions } from '../src/lib/github-public-actions.ts';
import {
  workflowOutcome,
  workflowOutcomeCount,
  filteredWorkflowRuns,
  workflowOutcomes,
} from '../src/lib/nexus-workflow-visuals.ts';

const repo = 'owner/sample';
const createRun = (id, status, conclusion) => ({
  id, name: 'Build ' + id, event: 'push', status, conclusion,
  created_at: '2026-10-13T12:00:00Z',
  html_url: 'https://github.com/' + repo + '/actions/runs/' + id,
});
const fixtures = [
  createRun(10, 'completed', 'success'),
  createRun(9, 'completed', 'failure'),
  createRun(8, 'completed', 'timed_out'),
  createRun(7, 'completed', 'startup_failure'),
  createRun(6, 'queued', null),
  createRun(5, 'in_progress', null),
  createRun(4, 'completed', 'cancelled'),
  createRun(3, 'completed', 'skipped'),
  createRun(2, 'completed', 'neutral'),
  createRun(1, 'completed', null),
];
const summary = () => summarizePublicActions(repo, {
  total_count: 56, workflow_runs: fixtures,
});

test('sample view exposes four mutually exclusive non-AI outcome categories', () => {
  const data = summary();
  const expected = {
    success: 1, failed: 3, pending: 2, other: 4,
  };
  assert.equal(data.inspected_runs, 10);
  assert.equal(data.total_matching_runs, 56);
  for (const { key } of workflowOutcomes) {
    assert.equal(workflowOutcomeCount(data, key), expected[key]);
    assert.equal(filteredWorkflowRuns(data, key).length, expected[key]);
  }
  assert.equal(workflowOutcomes.reduce((sum, o) => sum + workflowOutcomeCount(data, o.key), 0),
    data.inspected_runs);
});

test('cancelled, skipped, neutral and null conclusions are never called failures', () => {
  const data = summary();
  for (const run of data.runs.slice(6)) assert.equal(workflowOutcome(run), 'other');
  assert.equal(workflowOutcome(data.runs[4]), 'pending');
  assert.equal(workflowOutcome(data.runs[5]), 'pending');
  assert.equal(workflowOutcome(createRun(99, 'queued', 'failure')), 'pending');
  assert.equal(workflowOutcome(createRun(100, 'completed', 'unknown')), 'other');
});

test('filters only the existing ten-run sample and preserve server-supplied ordering', () => {
  const data = summary();
  const originalIds = data.runs.map(run => run.id);
  assert.deepEqual(filteredWorkflowRuns(data, 'all').map(run => run.id), originalIds);
  assert.deepEqual(filteredWorkflowRuns(data, 'failed').map(run => run.id), [9, 8, 7]);
  assert.deepEqual(filteredWorkflowRuns(data, 'success').map(run => run.id), [10]);
  assert.deepEqual(filteredWorkflowRuns(data, 'pending').map(run => run.id), [6, 5]);
  assert.deepEqual(filteredWorkflowRuns(data, 'other').map(run => run.id), [4, 3, 2, 1]);
  assert.deepEqual(data.runs.map(run => run.id), originalIds);
});

test('empty or unloaded samples never fabricate ratios, failures, or run links', () => {
  assert.deepEqual(filteredWorkflowRuns(null, 'all'), []);
  assert.deepEqual(filteredWorkflowRuns(null, 'failed'), []);
  const empty = summarizePublicActions(repo, { total_count: 0, workflow_runs: [] });
  assert.equal(empty.inspected_runs, 0);
  assert.deepEqual(filteredWorkflowRuns(empty, 'all'), []);
  for (const { key } of workflowOutcomes) {
    assert.equal(workflowOutcomeCount(empty, key), 0);
  }
});

test('pending status classifications agree with server for every supported active status', () => {
  for (const status of ['queued', 'in_progress', 'requested', 'waiting', 'pending']) {
    const item = createRun(77, status, null);
    const s = summarizePublicActions(repo, { total_count: 1, workflow_runs: [item] });
    assert.equal(workflowOutcome(item), 'pending');
    assert.equal(s.pending_runs, 1);
    assert.equal(filteredWorkflowRuns(s, 'pending').length, 1);
  }
});

test('a pure derived visualization requires no fetcher, credentials or upstream call', () => {
  const data = summary();
  const input = JSON.stringify(data);
  const filtered = filteredWorkflowRuns(data, 'failed');
  const counts = workflowOutcomes.map(o => workflowOutcomeCount(data, o.key));
  assert.deepEqual(counts, [1, 3, 2, 4]);
  assert.equal(filtered.length, 3);
  assert.equal(JSON.stringify(data), input);
});
