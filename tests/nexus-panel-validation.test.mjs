import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePublicActions } from '../src/lib/github-public-actions.ts';
import { summarizePublicPullRequests } from '../src/lib/nexus-public-prs.ts';
import { isPublicActionsSample, isPublicPullSample } from '../src/lib/nexus-panel-validation.ts';
import { readPublicPanel } from '../src/lib/nexus-panel-request.ts';

const repo = 'owner/example';
const run = (id, conclusion) => ({
  id, name: 'Continuous verification', event: 'push', status: 'completed',
  conclusion, created_at: '2026-10-13T11:00:00Z',
  html_url: `https://github.com/${repo}/actions/runs/${id}`,
});
const goodActions = () => summarizePublicActions(repo, {
  total_count: 2, workflow_runs: [run(7, 'success'), run(8, 'failure')],
});
const pr = (number, draft = false) => ({
  number, title: 'Important change', draft,
  updated_at: '2026-10-13T11:00:00Z',
  html_url: `https://github.com/${repo}/pull/${number}`,
  user: { login: 'contributor' },
});
const goodPulls = () => summarizePublicPullRequests(repo,
  [pr(2), pr(3, true)],
  [{ number: 2, html_url: `https://github.com/${repo}/pull/2`,
    mergeable: false, mergeable_state: 'dirty' }, null],
);
const clone = data => structuredClone(data);

test('valid, server-generated Actions and PR samples are accepted', () => {
  assert.equal(isPublicActionsSample(goodActions(), repo), true);
  assert.equal(isPublicPullSample(goodPulls(), repo), true);
  assert.equal(isPublicActionsSample(summarizePublicActions(repo, {total_count: 0,workflow_runs: []}), repo), true);
  assert.equal(isPublicPullSample(summarizePublicPullRequests(repo, [], []), repo), true);
});

test('wrong selected repository, unexpected arrays and unknown objects are not accepted', () => {
  for (const validate of [
    sample => isPublicActionsSample(sample, repo),
    sample => isPublicPullSample(sample, repo),
  ]) {
    for (const value of [null, [], [], 3, 'bad', { error: '200' }]) {
      assert.equal(validate(value), false);
    }
  }
  assert.equal(isPublicActionsSample(goodActions(), 'other/example'), false);
  assert.equal(isPublicPullSample(goodPulls(), 'other/example'), false);
});

test('Actions sample rejects manipulated counts, duplicate run ids, unsafe URLs, and invalid dates', () => {
  const changes = [
    a => { a.inspected_runs = 3; },
    a => { a.total_matching_runs = 1; },
    a => { a.successful_runs = -1; },
    a => { a.successful_runs = 2; },
    a => { a.runs[0].id = a.runs[1].id; },
    a => { a.runs[0].html_url = 'https://evil.example/x'; },
    a => { a.runs[0].created_at = 'yesterday'; },
    a => { a.runs = { 0: a.runs[0] }; },
    a => { a.runs[0].conclusion = 42; },
    a => { a.scope_note = null; },
  ];
  for (const change of changes) {
    const value = clone(goodActions());
    change(value);
    assert.equal(isPublicActionsSample(value, repo), false);
  }
});

test('PR sample rejects unknown attention, counter manipulation, duplicate PRs, and foreign links', () => {
  const changes = [
    p => { p.inspected_prs = 3; },
    p => { p.needs_attention = 0; },
    p => { p.conflicts = 2; },
    p => { p.unknown = 1; },
    p => { p.pull_requests[0].attention = 'automerge-safe'; },
    p => { p.pull_requests[0].number = p.pull_requests[1].number; },
    p => { p.pull_requests[0].html_url = 'https://attacker.invalid/fake'; },
    p => { p.pull_requests[0].updated_at = '?'; },
    p => { p.pull_requests[0].title = 12; },
    p => { p.pull_requests = null; },
  ];
  for (const change of changes) {
    const value = clone(goodPulls());
    change(value);
    assert.equal(isPublicPullSample(value, repo), false);
  }
});

test('readPublicPanel rejects 200 malformed data before app state, with no payload disclosure', async () => {
  let requests = 0;
  const source = { ...goodPulls(), repository: 'other/example',
    pull_requests: [{ html_url: 'https://attacker.invalid/exploit' }] };
  const output = await readPublicPanel('/api/public-prs?repository=owner/example',
    new AbortController().signal,
    async (_url, options) => {
      requests += 1;
      assert.equal(options.cache, 'no-store');
      return Response.json(source);
    },
    value => isPublicPullSample(value, repo),
  );
  assert.equal(requests, 1);
  assert.equal(output.data, null);
  assert.match(output.error, /could not be verified/i);
  assert.doesNotMatch(output.error, /attacker|other\/example/i);
});

test('readPublicPanel passes validated data and preserves HTTP error semantics', async () => {
  const summary = goodActions();
  const success = await readPublicPanel('/api/public-actions',
    new AbortController().signal,
    async () => Response.json(summary),
    value => isPublicActionsSample(value, repo),
  );
  assert.deepEqual(success, {data: summary, error: null});
  const rateLimited = await readPublicPanel('/api/public-actions',
    new AbortController().signal,
    async () => Response.json({ error: 'limit' },
      { status: 429, headers: { 'Retry-After': '21' } }),
    value => isPublicActionsSample(value, repo),
  );
  assert.equal(rateLimited.data, null);
  assert.match(rateLimited.error, /wait at least 21 seconds/i);
});
