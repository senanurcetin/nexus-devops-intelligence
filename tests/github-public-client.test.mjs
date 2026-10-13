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

test('Actions: GitHub 403 exhausted quota is 429, while ordinary 403 stays restricted', async () => {
  const quota = await loadPublicActions(repo, async () => ({
    ...answer(403, null), headers: { get: key => key === 'x-ratelimit-remaining' ? '0' : null },
  }));
  assert.equal(quota.status, 429);
  assert.match(quota.body.error, /rate limit/i);
  const forbidden = await loadPublicActions(repo, async () => ({
    ...answer(403, null), headers: { get: key => key === 'x-ratelimit-remaining' ? '25' : null },
  }));
  assert.equal(forbidden.status, 503);
});

test('Actions: GitHub secondary 403 limits are mapped to 429 without a retry', async () => {
  const responses = [
    { ...answer(403, { message: 'You have exceeded a secondary rate limit.' }),
      headers: { get: key => key === 'x-ratelimit-remaining' ? '55' : null } },
    { ...answer(403, { message: 'forbidden' }),
      headers: { get: key => key === 'retry-after' ? '60' : key === 'x-ratelimit-remaining' ? '50' : null } },
    { ...answer(403, { message: 'API rate limit exceeded for this user.' }),
      headers: { get: () => null } },
  ];
  for (const response of responses) {
    let calls = 0;
    const result = await loadPublicActions(repo, async () => { calls++; return response; });
    assert.equal(result.status, 429);
    assert.equal(calls, 1, 'never automatically retry a GitHub rate-limited GET');
    assert.match(result.body.error, /rate limit/i);
    assert.doesNotMatch(result.body.error, /forbidden|user/i);
  }
});

test('Actions: ordinary 403, malformed upstream error, and 401 stay restricted', async () => {
  for (const response of [
    { ...answer(403, { message: 'Resource not accessible by integration' }),
      headers: { get: key => key === 'x-ratelimit-remaining' ? '42' : null } },
    { ok: false, status: 403, json: async () => { throw Error('upstream private body'); } },
    answer(401, { message: 'Bad credentials' }),
  ]) {
    const result = await loadPublicActions(repo, async () => response);
    assert.equal(result.status, 503);
    assert.doesNotMatch(result.body.error, /upstream private|Bad credentials/);
  }
});

test('PRs: secondary limit on list returns 429 without fetching details', async () => {
  let calls = 0;
  const result = await loadPublicPulls(repo, async () => {
    calls++;
    return answer(403, { message: 'You have exceeded a secondary rate limit.' });
  });
  assert.equal(result.status, 429);
  assert.equal(calls, 1);
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

test('PRs: draft skips detail request, ordinary partial failure remains unknown', async () => {
  const { calls, fetcher } = fakeFetcher(url => {
    if (url.includes('per_page=6')) return answer(200, [goodPR(10, true), goodPR(11), goodPR(12)]);
    if (url.endsWith('/pulls/11')) return answer(200, details(11, 'dirty'));
    if (url.endsWith('/pulls/12')) return answer(503, null);
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

test('Actions: bounded GitHub Retry-After hint passes through a 429 without retry', async () => {
  const { fetcher, calls } = fakeFetcher(() => ({
    ...answer(429, { message: 'secret upstream details' }),
    headers: { get: key => key === 'retry-after' ? '90' : null },
  }));
  const result = await loadPublicActions(repo, fetcher);
  assert.equal(result.status, 429);
  assert.equal(result.retryAfterSeconds, 90);
  assert.equal(calls.length, 1);
  assert.doesNotMatch(result.body.error, /secret/);
});

test('PRs: secondary 403 limit includes numeric Retry-After without requesting details', async () => {
  const { fetcher, calls } = fakeFetcher(() => ({
    ...answer(403, { message: 'You have exceeded a secondary rate limit.' }),
    headers: { get: key => key === 'retry-after' ? '120' : null },
  }));
  const result = await loadPublicPulls(repo, fetcher);
  assert.equal(result.status, 429);
  assert.equal(result.retryAfterSeconds, 120);
  assert.equal(calls.length, 1);
});

test('Actions: untrusted Retry-After header is not forwarded', async () => {
  for (const header of ['720000', '-1', 'Wed, 21 Oct 2026 07:28:00 GMT']) {
    const result = await loadPublicActions(repo, async () => ({
      ...answer(429, null),
      headers: { get: key => key === 'retry-after' ? header : null },
    }));
    assert.equal(result.status, 429);
    assert.equal(result.retryAfterSeconds, undefined);
  }
});

test('PRs: 429 from a detail makes the whole result 429, not misleading success', async () => {
  const { calls, fetcher } = fakeFetcher(url => {
    if (url.includes('per_page=6')) return answer(200, [goodPR(1, true), goodPR(2), goodPR(3)]);
    if (url.endsWith('/pulls/2')) return answer(200, details(2, 'clean'));
    if (url.endsWith('/pulls/3')) return {
      ...answer(429, { message: 'private upstream detail' }),
      headers: { get: key => key === 'retry-after' ? '90' : null },
    };
    throw Error(`Unexpected ${url}`);
  });
  const result = await loadPublicPulls(repo, fetcher);
  assert.equal(result.status, 429);
  assert.equal(result.retryAfterSeconds, 90);
  assert.match(result.body.error, /rate limit/i);
  assert.doesNotMatch(result.body.error, /private upstream/);
  assert.equal(calls.length, 3);
  assert.ok(!calls.some(call => call.url.endsWith('/pulls/1')));
});

test('PRs: secondary 403 on a detail also propagates as 429', async () => {
  const { calls, fetcher } = fakeFetcher(url => {
    if (url.includes('per_page=6')) return answer(200, [goodPR(4)]);
    return {
      ...answer(403, { message: 'You have exceeded a secondary rate limit.' }),
      headers: { get: key => key === 'x-ratelimit-remaining' ? '41' : key === 'retry-after' ? '120' : null },
    };
  });
  const result = await loadPublicPulls(repo, fetcher);
  assert.equal(result.status, 429);
  assert.equal(result.retryAfterSeconds, 120);
  assert.equal(calls.length, 2);
});

test('PRs: multiple detail limits select the longest safe Retry-After', async () => {
  const { calls, fetcher } = fakeFetcher(url => {
    if (url.includes('per_page=6')) return answer(200, [goodPR(6), goodPR(7), goodPR(8)]);
    const number = Number(url.split('/').at(-1));
    return {
      ...answer(429, null),
      headers: { get: key => key === 'retry-after'
        ? number === 6 ? '30' : number === 7 ? '240' : '90000'
        : null },
    };
  });
  const result = await loadPublicPulls(repo, fetcher);
  assert.equal(result.status, 429);
  assert.equal(result.retryAfterSeconds, 240);
  assert.equal(calls.length, 4);
});

test('PRs: all detail wait hints invalid return 429 without forwarding a header', async () => {
  const { fetcher } = fakeFetcher(url => url.includes('per_page=6')
    ? answer(200, [goodPR(9)])
    : { ...answer(429, null), headers: { get: key => key === 'retry-after' ? '9999999' : null } });
  const result = await loadPublicPulls(repo, fetcher);
  assert.equal(result.status, 429);
  assert.equal(result.retryAfterSeconds, undefined);
});

test('PRs: at most two detail GETs run concurrently while preserving result order', async () => {
  const list = Array.from({ length: 5 }, (_, i) => goodPR(i + 1));
  let active = 0;
  let maxActive = 0;
  const { calls, fetcher } = fakeFetcher(async url => {
    if (url.includes('per_page=6')) return answer(200, list);
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    const number = Number(url.split('/').at(-1));
    return answer(200, details(number, number === 3 ? 'dirty' : 'clean'));
  });
  const result = await loadPublicPulls(repo, fetcher);
  assert.equal(result.status, 200);
  assert.equal(maxActive, 2, 'bounded worker pool must not exceed two detail requests');
  assert.equal(calls.length, 6, 'one list and five detail GETs when not rate-limited');
  assert.deepEqual(result.body.pull_requests.map(pr => pr.number), [1, 2, 3, 4, 5]);
  assert.deepEqual(result.body.pull_requests.map(pr => pr.attention),
    ['clear', 'clear', 'conflict', 'clear', 'clear']);
});

test('PRs: observed detail rate limit prevents any queued requests from starting', async () => {
  const list = Array.from({ length: 5 }, (_, i) => goodPR(i + 1));
  const started = [];
  const pending = new Map();
  let bothStarted;
  const ready = new Promise(resolve => { bothStarted = resolve; });
  const { calls, fetcher } = fakeFetcher(url => {
    if (url.includes('per_page=6')) return answer(200, list);
    const number = Number(url.split('/').at(-1));
    started.push(number);
    if (started.length === 2) bothStarted();
    return new Promise(resolve => pending.set(number, resolve));
  });
  const operation = loadPublicPulls(repo, fetcher);
  await ready;
  assert.deepEqual(started, [1, 2]);
  pending.get(1)({
    ...answer(429, { message: 'private upstream text' }),
    headers: { get: key => key === 'retry-after' ? '60' : null },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, [1, 2], 'quota observation must stop new detail GETs');
  pending.get(2)(answer(200, details(2)));
  const result = await operation;
  assert.equal(result.status, 429);
  assert.equal(result.retryAfterSeconds, 60);
  assert.equal(calls.length, 3, 'the queued three detail calls were not sent');
  assert.doesNotMatch(result.body.error, /private upstream/);
});

test('PRs: multiple already-in-flight limits retain longest trusted wait without new fanout', async () => {
  const list = Array.from({ length: 5 }, (_, i) => goodPR(i + 1));
  const pending = new Map();
  let bothStarted;
  const ready = new Promise(resolve => { bothStarted = resolve; });
  const { calls, fetcher } = fakeFetcher(url => {
    if (url.includes('per_page=6')) return answer(200, list);
    const number = Number(url.split('/').at(-1));
    if (pending.size === 1) bothStarted();
    return new Promise(resolve => pending.set(number, resolve));
  });
  const operation = loadPublicPulls(repo, fetcher);
  await ready;
  pending.get(1)({
    ...answer(429, null),
    headers: { get: key => key === 'retry-after' ? '30' : null },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 3);
  pending.get(2)({
    ...answer(429, null),
    headers: { get: key => key === 'retry-after' ? '240' : null },
  });
  const result = await operation;
  assert.equal(result.status, 429);
  assert.equal(result.retryAfterSeconds, 240);
  assert.equal(calls.length, 3);
});
