import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinatePublicQuery, publicRequestKey } from '../src/lib/nexus-public-gate.ts';

const ok = { status: 200, body: { inspected_runs: 0 } };

test('public gate: repository keys normalize whitespace/case and separate route kinds', () => {
  assert.equal(publicRequestKey('actions', ' Owner/Repo '), 'actions:owner/repo');
  assert.notEqual(publicRequestKey('actions', 'Owner/Repo'), publicRequestKey('prs', 'Owner/Repo'));
});

test('public gate: duplicate in-flight query executes only once', async () => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const load = async () => { calls++; await hold; return ok; };
  const first = coordinatePublicQuery('actions:dedupe-repo', load);
  const second = coordinatePublicQuery('actions:dedupe-repo', load);
  assert.strictEqual(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await first, ok);
  assert.deepEqual(await coordinatePublicQuery('actions:dedupe-repo', async () => { calls++; return ok; }), ok);
  assert.equal(calls, 2);
});

test('public gate: 13th different in-flight key is denied without calling upstream', async () => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const pending = [];
  for (let i = 0; i < 12; i++) {
    pending.push(coordinatePublicQuery(`actions:busy-${i}`, async () => { await hold; return ok; }));
  }
  let called = false;
  const denied = await coordinatePublicQuery('actions:busy-overflow', async () => {
    called = true; return ok;
  });
  assert.equal(denied.status, 503);
  assert.match(denied.body.error, /temporarily busy/);
  assert.equal(called, false);
  release();
  await Promise.all(pending);
  const recovered = await coordinatePublicQuery('actions:busy-overflow', async () => ok);
  assert.equal(recovered.status, 200);
});

test('public gate: thrown upstream errors are sanitized and slots are released', async () => {
  const response = await coordinatePublicQuery('prs:failing', async () => {
    throw new Error('secret/internal service detail');
  });
  assert.equal(response.status, 502);
  assert.doesNotMatch(response.body.error, /secret/);
  assert.equal((await coordinatePublicQuery('prs:failing', async () => ok)).status, 200);
});
