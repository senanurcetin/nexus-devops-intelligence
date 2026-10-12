import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPublicActions, loadPublicPulls } from '../src/lib/github-public-client.ts';

const repo = 'owner/example';
const goodRun = (id = 12) => ({
  id, name: 'Build', event: 'push', status: 'completed', conclusion: 'success',
  created_at: '2026-10-12T12:00:00Z',
  html_url: `https://github.com/${repo}/actions/runs/${id}`,
});
const goodPR = (number, draft = false) => ({
  number, title: 'Change', draft, updated_at: '2026-10-12T12:00:00Z',
  html_url: `https://github.com/${repo}/pull/${number}`,
  user: { login: 'maintainer' },
});
const details = (number, state = 'clean') => ({
  number, mergeable: true, mergeable_state: state,
  html_url: `https://github.com/${repo}/pull/${number}`,
});
const answer = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

function fakeFetcher(responder) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    assert.match(url, /^https:\/\/api\.github\.com\/repos\/owner\/example\//);
    assert.equal(options.headers['User-Agent'], 'nexus-devops-intelligence-public-preview');
    assert.equal(options.next.revalidate, 120);
    assert.ok(options.signal instanceof AbortSignal);
    return responder(url, calls.length);
  };
  return { calls, fetcher };
}

test('Actions: validates repository before touching the network', async () => {
  let count = 0;
  const result = await loadPublicActions('not a repo', async () => { count++; throw Error('unreachable'); });
  assert.equal(result.status, 400);
  assert.equal(count, 0);
});

test('Actions: valid empty workflow history and exactly one GET', async () => {
  const { calls, fetcher } = fakeFetcher(() => answer(200, { total_count: 0, workflow_runs: [] }));
  const result = await loadPublicActions(repo, fetcher);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.runs, []);
  assert.equal(result.body.inspected_runs, 0);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /actions\/runs\?per_page=10/);
});

test('Actions: malformed JSON, 404, rate-limits and upstream 503 fail closed', async () => {
  for (const [response, expected] of [
    [answer(404, null), 404], [answer(429, null), 429], [answer(503, null), 503],
    [answer(200, { workflow_runs: 'oops' }), 502],
    [{ ok: true, status: 200, json: async () => { throw Error('bad JSON'); } }, 502],
  ]) {
    const result = await loadPublicActions(repo, async () => response);
    assert.equal(result.status, expected);
    assert.equal(typeof result.body.error, 'string');
  }
});

test('Actions: network and timeout errors are explicit', async () => {
  const network = await loadPublicActions(repo, async () => { throw Error('offline'); });
  assert.equal(network.status, 503);
  const timeout = await loadPublicActions(repo, async () => { throw new DOMException('timed out', 'TimeoutError'); });
  assert.equal(timeout.status, 504);
});

test('Actions: returns actual sampled runs, without pretending billed minutes', async () => {
  const r = await loadPublicActions(repo, async () => answer(200, { total_count: 20, workflow_runs: [goodRun()] }));
  assert.equal(r.status, 200);
  assert.equal(r.body.total_matching_runs, 20);
  assert.match(r.body.scope_note, /not billed minutes/);
});

test('PRs: an empty list needs one request and returns an empty sample', async () => {
  const { calls, fetcher } = fakeFetcher(() => answer(200, []));
  const result = await loadPublicPulls(repo, fetcher);
  assert.equal(result.status, 200);
  assert.equal(result.body.inspected_prs, 0);
  assert.equal(calls.length, 1);
});

test('PRs: list validates identities before requesting details', async () => {
  const { calls, fetcher } = fakeFetcher(() => answer(200, [goodPR(1), { ...goodPR(2), html_url: 'https://evil.example' }]));
  const result = await loadPublicPulls(repo, fetcher);
  assert.equal(result.status, 502);
  assert.equal(calls.length, 1);
});

test('PRs: draft skips detail request, a partial detail failure remains unknown', async () => {
  const { calls, fetcher } = fakeFetcher(url => {
    if (url.includes('per_page=6')) return answer(200, [goodPR(10, true), goodPR(11), goodPR(12)]);
    if (url.endsWith('/pulls/11')) return answer(200, details(11, 'dirty'));
    if (url.endsWith('/pulls/12')) return answer(429, null);
    throw Error(`Unexpected ${url}`);
  });
  const result = await loadPublicPulls(repo, fetcher);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.pull_requests.map(p => p.attention), ['draft', 'conflict', 'unknown']);
  assert.equal(result.body.conflicts, 1);
  assert.equal(result.body.unknown, 1);
  assert.equal(calls.length, 3);
  assert.ok(!calls.some(c => c.url.endsWith('/pulls/10')));
});

test('PRs: fanout is bounded and count is labeled as a sample', async () => {
  const prs = Array.from({ length: 6 }, (_, i) => goodPR(i + 1));
  const { calls, fetcher } = fakeFetcher(url =>
    url.includes('per_page=6') ? answer(200, prs) : answer(200, details(Number(url.split('/').at(-1)))));
  const result = await loadPublicPulls(repo, fetcher);
  assert.equal(result.status, 200);
  assert.equal(result.body.inspected_prs, 5);
  assert.equal(result.body.more_open_prs, true);
  assert.equal(calls.length, 6);
});

test('PRs: list 404, 429, garbage payload and failed JSON map to safe errors', async () => {
  for (const [response, expected] of [
    [answer(404, []), 404], [answer(429, []), 429],
    [answer(200, 'wrong'), 502],
    [{ ok: true, status: 200, json: async () => { throw Error('invalid'); } }, 502],
  ]) {
    const result = await loadPublicPulls(repo, async () => response);
    assert.equal(result.status, expected);
    assert.equal(typeof result.body.error, 'string');
  }
});

test('PRs: malformed detail never makes a PR look safely mergeable', async () => {
  const { fetcher } = fakeFetcher(url =>
    url.includes('per_page=6') ? answer(200, [goodPR(11)])
      : answer(200, { ...details(11), number: 12 }));
  const result = await loadPublicPulls(repo, fetcher);
  assert.equal(result.status, 200);
  assert.equal(result.body.pull_requests[0].attention, 'unknown');
});
