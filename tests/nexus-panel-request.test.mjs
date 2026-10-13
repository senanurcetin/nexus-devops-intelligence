import test from 'node:test';
import assert from 'node:assert/strict';
import { readPublicPanel, emptyPanel } from '../src/lib/nexus-panel-request.ts';

const signal = () => new AbortController().signal;
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json' },
});

test('panel adapter: successful JSON object retains data without an error', async () => {
  let fetchCount = 0;
  const result = await readPublicPanel('/api/public-actions', signal(), async (_url, init) => {
    fetchCount++;
    assert.equal(init.cache, 'no-store');
    assert.ok(init.signal);
    return json({ repository: 'owner/repo', inspected_runs: 0 });
  });
  assert.equal(fetchCount, 1);
  assert.equal(result.data.repository, 'owner/repo');
  assert.equal(result.error, null);
});

test('panel adapter: 429 WAF HTML is announced as rate limit, not JSON parse failure', async () => {
  const result = await readPublicPanel('/api/public-prs', signal(),
    async () => new Response('<html>Limited</html>', { status: 429 }));
  assert.equal(result.data, null);
  assert.match(result.error, /request limit/i);
  assert.doesNotMatch(result.error, /html|syntax/i);
});

test('panel adapter: restricted public API 404 and 503 errors remain helpful', async () => {
  const missing = await readPublicPanel('/api/public-prs', signal(),
    async () => json({ error: 'Public repository not found.' }, 404));
  assert.equal(missing.error, 'Public repository not found.');
  const upstream = await readPublicPanel('/api/public-prs', signal(),
    async () => json({ error: 'GitHub API is currently unavailable.' }, 503));
  assert.equal(upstream.error, 'GitHub API is currently unavailable.');
});

test('panel adapter: malformed and non-JSON payloads fail without leaking server markup', async () => {
  const responses = [
    new Response('<b>private error</b>', { status: 503 }),
    new Response('{', { status: 200 }),
    json([1, 2, 3]),
    json({ error: '' }, 500),
  ];
  for (const response of responses) {
    const result = await readPublicPanel('/api/public-actions', signal(), async () => response);
    assert.equal(result.data, null);
    assert.equal(typeof result.error, 'string');
    assert.doesNotMatch(result.error, /private error|<b>/);
  }
});

test('panel adapter: network failure is safe and aborted request stays silent', async () => {
  const ctl = new AbortController();
  const unavailable = await readPublicPanel('/api/public-actions', ctl.signal,
    async () => { throw new Error('private upstream IP and token'); });
  assert.equal(unavailable.data, null);
  assert.match(unavailable.error, /Network request failed/);
  assert.doesNotMatch(unavailable.error, /token|private/);
  ctl.abort();
  const aborted = await readPublicPanel('/api/public-actions', ctl.signal,
    async () => { throw new Error('aborted'); });
  assert.deepEqual(aborted, emptyPanel());
});

test('panel adapter: server-supplied oversized errors are not displayed', async () => {
  const result = await readPublicPanel('/api/public-actions', signal(),
    async () => json({ error: 's'.repeat(400) }, 502));
  assert.equal(result.data, null);
  assert.ok(result.error.length < 300);
});

test('panel adapter: displays bounded WAF Retry-After guidance without auto-retry', async () => {
  let calls = 0;
  const result = await readPublicPanel('/api/public-actions', signal(), async () => {
    calls++;
    return new Response('<html>WAF blocked</html>', { status: 429, headers: { 'Retry-After': '42' } });
  });
  assert.equal(calls, 1);
  assert.equal(result.data, null);
  assert.match(result.error, /wait at least 42 seconds/i);
  assert.doesNotMatch(result.error, /WAF blocked|html/i);
});

test('panel adapter: ignores malformed and oversized WAF Retry-After hints', async () => {
  for (const value of ['9999999', 'date unavailable', '-8']) {
    const result = await readPublicPanel('/api/public-prs', signal(), async () =>
      new Response('Rate limit', { status: 429, headers: { 'Retry-After': value } }));
    assert.match(result.error, /try again shortly/i);
    assert.doesNotMatch(result.error, /9999999|unavailable|-8/);
  }
});
