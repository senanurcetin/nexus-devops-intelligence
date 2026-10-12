import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendInvestigations } from '../src/lib/nexus-recommendations.ts';
import { summarizePublicPullRequests } from '../src/lib/nexus-public-prs.ts';
import { summarizePublicActions } from '../src/lib/github-public-actions.ts';

const repository = 'owner/example';
const pr = (number, draft = false) => ({
  number, title: `Change ${number}`, draft,
  updated_at: '2026-10-13T00:00:00Z',
  html_url: `https://github.com/${repository}/pull/${number}`,
});
const detail = (number, mergeable_state = 'clean') => ({
  number, mergeable_state, mergeable: mergeable_state !== 'dirty',
  html_url: `https://github.com/${repository}/pull/${number}`,
});
const run = (id, conclusion) => ({
  id, name: 'CI', event: 'push', conclusion, status: 'completed',
  created_at: '2026-10-13T00:00:00Z',
  html_url: `https://github.com/${repository}/actions/runs/${id}`,
});

test('returns no alerts when there is no inspected evidence', () => {
  assert.deepEqual(recommendInvestigations(null, null), []);
  const a = summarizePublicActions(repository, { total_count: 1, workflow_runs: [run(7, 'success')] });
  const p = summarizePublicPullRequests(repository, [pr(1)], [detail(1)]);
  assert.deepEqual(recommendInvestigations(a, p), []);
});

test('flags only GitHub-confirmed failure and PR attention statuses', () => {
  const a = summarizePublicActions(repository, { total_count: 3, workflow_runs: [
    run(2, 'failure'), run(3, 'cancelled'), run(4, null),
  ] });
  const p = summarizePublicPullRequests(repository, [pr(10), pr(11), pr(12, true)],
    [detail(10, 'dirty'), null, null]);
  const list = recommendInvestigations(a, p);
  assert.deepEqual(list.map(x => x.key), ['pr-10', 'run-2', 'pr-11']);
  assert.deepEqual(list.map(x => x.severity), ['high', 'high', 'info']);
  assert.match(list[1].explanation, /before diagnosing a cause/);
  assert.ok(!list.some(x => x.key.includes('12') || x.key.includes('3') || x.key.includes('4')));
});

test('limits suggestions to five and keeps high-priority confirmed failures first', () => {
  const p = summarizePublicPullRequests(repository, Array.from({length:5},(_,i)=>pr(i+1)),
    [null, detail(2,'behind'), detail(3,'blocked'), detail(4,'unstable'), detail(5,'dirty')]);
  const a = summarizePublicActions(repository, { total_count: 2, workflow_runs: [run(7,'failure'),run(8,'failure')] });
  const list = recommendInvestigations(a,p);
  assert.equal(list.length,5);
  assert.deepEqual(list.map(x=>x.key), ['pr-5','run-7','run-8','pr-2','pr-3']);
});
