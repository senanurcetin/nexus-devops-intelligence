import test from 'node:test';
import assert from 'node:assert/strict';
import { readPublicPanel, emptyPanel } from '../src/lib/nexus-panel-request.ts';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const json = value => new Response(JSON.stringify(value), {
  headers: { 'content-type': 'application/json' },
});
const flush = () => new Promise(resolve => setImmediate(resolve));

test('an already-aborted panel does not call an upstream fetcher', async () => {
  const ctl = new AbortController();
  ctl.abort();
  let invoked = 0;
  const value = await readPublicPanel('/api/public-actions', ctl.signal, async () => {
    invoked++;
    return json({ data: 'never' });
  });
  assert.equal(invoked, 0);
  assert.deepEqual(value, emptyPanel());
});

test('late valid 200 after abort cannot surface stale data', async () => {
  const ctl = new AbortController();
  const pending = deferred();
  let started = 0;
  const result = readPublicPanel('/api/public-prs', ctl.signal, async () => {
    started++;
    return pending.promise;
  });
  await flush();
  assert.equal(started, 1);
  ctl.abort();
  pending.resolve(json({ repository: 'owner/old', inspected_prs: 5 }));
  assert.deepEqual(await result, emptyPanel());
});

test('late 429 or 503 after abort cannot resurrect obsolete panel errors', async () => {
  for (const status of [429, 503]) {
    const ctl = new AbortController();
    const pending = deferred();
    const result = readPublicPanel('/api/public-actions', ctl.signal, () => pending.promise);
    await flush();
    ctl.abort();
    pending.resolve(new Response('untrusted WAF or API error', { status }));
    assert.deepEqual(await result, emptyPanel());
  }
});

test('abort while JSON body is pending keeps panel silent', async () => {
  const ctl = new AbortController();
  let pushBody;
  const body = new ReadableStream({
    start(controller) { pushBody = controller; },
  });
  const result = readPublicPanel('/api/public-actions', ctl.signal,
    async () => new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
  await flush();
  ctl.abort();
  pushBody.enqueue(new TextEncoder().encode('{"repository":"owner/old"}'));
  pushBody.close();
  assert.deepEqual(await result, emptyPanel());
});

test('a newly selected repository can succeed when the obsolete request resolves last', async () => {
  const oldCtl = new AbortController();
  const nextCtl = new AbortController();
  const oldResponse = deferred();
  const oldResult = readPublicPanel('/api/public-prs', oldCtl.signal,
    () => oldResponse.promise);
  oldCtl.abort();
  const newResult = readPublicPanel('/api/public-prs', nextCtl.signal,
    async () => json({ repository: 'owner/new', inspected_prs: 1 }));
  assert.deepEqual((await newResult).data, { repository: 'owner/new', inspected_prs: 1 });
  oldResponse.resolve(json({ repository: 'owner/old', inspected_prs: 5 }));
  assert.deepEqual(await oldResult, emptyPanel());
});

test('isolated failed panel never prevents a successful sibling from returning its data', async () => {
  const first = new AbortController();
  const second = new AbortController();
  const [actions, prs] = await Promise.all([
    readPublicPanel('/api/public-actions', first.signal,
      async () => new Response('API error', { status: 503 })),
    readPublicPanel('/api/public-prs', second.signal,
      async () => json({ repository: 'owner/repo', inspected_prs: 0 })),
  ]);
  assert.equal(actions.data, null);
  assert.match(actions.error, /unavailable/i);
  assert.equal(prs.data?.repository, 'owner/repo');
  assert.equal(prs.error, null);
});
