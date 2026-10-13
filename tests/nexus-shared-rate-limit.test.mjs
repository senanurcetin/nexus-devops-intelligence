import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkSharedPublicRateLimitForSource } from '../src/lib/nexus-shared-rate-limit.ts';

const goodConfig = {
  UPSTASH_REDIS_REST_URL: 'https://nexus-test-123.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'unit-test-token-only',
};

function fakeRedis() {
  const counts = new Map();
  const requests = [];
  const fetcher = async (url, init) => {
    const cmd = JSON.parse(init.body);
    requests.push({ url, ...init, cmd });
    assert.equal(cmd[0], 'EVAL');
    assert.equal(cmd[2], 1);
    assert.equal(cmd[4], 60);
    const key = cmd[3];
    const value = (counts.get(key) ?? 0) + 1;
    counts.set(key, value);
    return Response.json({ result: [value, 42] });
  };
  return { fetcher, requests, counts };
}

test('shared gate remains inactive without credentials; incomplete credentials fail closed', async () => {
  assert.deepEqual(await checkSharedPublicRateLimitForSource('203.0.113.5', {
    env: {},
    fetcher: () => { throw Error('should not run'); },
  }), { kind: 'disabled' });
  assert.deepEqual(await checkSharedPublicRateLimitForSource('203.0.113.5', {
    env: { UPSTASH_REDIS_REST_URL: goodConfig.UPSTASH_REDIS_REST_URL },
  }), { kind: 'unavailable' });
});

test('one shared anonymous-IP budget produces 429 after 20 admitted requests', async () => {
  const redis = fakeRedis();
  for (let i = 1; i <= 20; i += 1) {
    assert.deepEqual(await checkSharedPublicRateLimitForSource('203.0.113.5', {
      env: goodConfig,
      fetcher: redis.fetcher,
    }), { kind: 'allowed' });
  }
  assert.deepEqual(await checkSharedPublicRateLimitForSource('203.0.113.5', {
    env: goodConfig,
    fetcher: redis.fetcher,
  }), { kind: 'limited', retryAfterSeconds: 42 });
  assert.equal(redis.counts.size, 1);
  assert.equal(redis.requests.length, 21);
  const command = redis.requests[0].cmd;
  assert.equal(command[3].startsWith('nexus:public-github:ip:'), true);
  assert.equal(command[3].includes('203.0.113.5'), false);
  assert.equal(command[1].includes("redis.call('INCR', KEYS[1])"), true);
  assert.equal(command[1].includes("redis.call('EXPIRE', KEYS[1]"), true);
  assert.equal(redis.requests[0].url, goodConfig.UPSTASH_REDIS_REST_URL);
  assert.equal(redis.requests[0].headers.Authorization, 'Bearer unit-test-token-only');
  assert.equal(redis.requests[0].cache, 'no-store');
});

test('IPv4 and mapped IPv6 use the same opaque cross-instance key, other IP stays independent', async () => {
  const redis = fakeRedis();
  for (const ip of ['198.51.100.10', '::ffff:198.51.100.10', '198.51.100.11']) {
    assert.deepEqual(await checkSharedPublicRateLimitForSource(ip, {
      env: goodConfig, fetcher: redis.fetcher,
    }), { kind: 'allowed' });
  }
  assert.equal(redis.requests[0].cmd[3], redis.requests[1].cmd[3]);
  assert.notEqual(redis.requests[0].cmd[3], redis.requests[2].cmd[3]);
  assert.equal(redis.counts.size, 2);
});

test('refuses non-Upstash endpoint to avoid leaking bearer token', async () => {
  let calls = 0;
  for (const endpoint of [
    'http://nexus-test-123.upstash.io',
    'https://upstash.io.attacker.example',
    'https://attacker.example',
    'https://nexus-test-123.upstash.io@attacker.example',
    'https://nexus-test-123.upstash.io/path',
    'https://nexus-test-123.upstash.io:8443',
  ]) {
    const result = await checkSharedPublicRateLimitForSource('198.51.100.1', {
      env: { ...goodConfig, UPSTASH_REDIS_REST_URL: endpoint },
      fetcher: () => { calls += 1; throw Error('should not call'); },
    });
    assert.deepEqual(result, { kind: 'unavailable' });
  }
  assert.equal(calls, 0);
});

test('Redis failures and malformed EVAL output fail closed', async () => {
  const outputs = [
    () => Promise.reject(new Error('network down')),
    () => Promise.resolve(new Response('no', { status: 401 })),
    () => Promise.resolve(Response.json({ error: 'invalid token' }, { status: 200 })),
    () => Promise.resolve(Response.json({ result: [20] })),
    () => Promise.resolve(Response.json({ result: ['20', 60] })),
    () => Promise.resolve(Response.json({ result: [20, -1] })),
    () => Promise.resolve(new Response('not json')),
  ];
  for (const fetcher of outputs) {
    assert.deepEqual(await checkSharedPublicRateLimitForSource('192.0.2.1', {
      env: goodConfig, fetcher,
    }), { kind: 'unavailable' });
  }
});

test('both public routes perform shared check before any GitHub query and fail closed', () => {
  for (const path of [
    '../src/app/api/public-actions/route.ts',
    '../src/app/api/public-prs/route.ts',
  ]) {
    const src = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.ok(src.includes("checkVercelSharedPublicRateLimit(request.headers)"));
    assert.ok(src.indexOf('checkVercelSharedPublicRateLimit(request.headers)') <
      src.indexOf('coordinatePublicQuery('));
    assert.ok(src.includes("sharedLimit.kind === 'limited'"));
    assert.ok(src.includes("sharedLimit.kind === 'unavailable'"));
    assert.ok(src.includes("status: 503, headers: { 'Cache-Control': 'no-store'"));
  }
});
