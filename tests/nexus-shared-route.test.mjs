import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as actionsGET } from '../src/app/api/public-actions/route.ts';
import { GET as prsGET } from '../src/app/api/public-prs/route.ts';

const api = 'http://localhost:3000';
const config = {
  VERCEL: '1',
  UPSTASH_REDIS_REST_URL: 'https://nexus-test-123.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'route-test-token',
};

async function withSharedGate(fakeFetch, verify) {
  const env = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, config);
  globalThis.fetch = fakeFetch;
  try {
    await verify();
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function request(route, ip) {
  return new NextRequest(`${api}${route}?repository=owner%2Fexample`, {
    headers: { 'x-vercel-forwarded-for': ip, 'x-forwarded-for': '9.9.9.9' },
  });
}

test('both real Next routes return shared Redis 429 before any GitHub GET', async () => {
  const seen = [];
  await withSharedGate(async (url, options) => {
    assert.equal(String(url), config.UPSTASH_REDIS_REST_URL);
    const command = JSON.parse(options.body);
    seen.push(command);
    return Response.json({ result: [21, 17] });
  }, async () => {
    for (const [route, GET] of [
      ['/api/public-actions', actionsGET],
      ['/api/public-prs', prsGET],
    ]) {
      const result = await GET(request(route, '198.51.100.141'));
      assert.equal(result.status, 429);
      assert.equal(result.headers.get('cache-control'), 'no-store');
      assert.equal(result.headers.get('retry-after'), '17');
      assert.match((await result.json()).error, /limit/i);
    }
    assert.equal(seen.length, 2);
    assert.equal(seen[0][3], seen[1][3], 'both routes use one Redis bucket');
  });
});

test('configured Redis outage returns 503/no-store before any GitHub GET', async () => {
  let calls = 0;
  await withSharedGate(async url => {
    assert.match(String(url), /upstash.io/);
    calls += 1;
    return new Response('unavailable', { status: 503 });
  }, async () => {
    for (const [route, GET] of [
      ['/api/public-actions', actionsGET],
      ['/api/public-prs', prsGET],
    ]) {
      const response = await GET(request(route, '198.51.100.142'));
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('retry-after'), '5');
      assert.match((await response.json()).error, /temporarily unavailable/i);
    }
    assert.equal(calls, 2, 'only the Redis gate was queried');
  });
});


test('shared Redis counter remains authoritative after twenty per-IP calls on both routes', async () => {
  const counters = new Map();
  let githubCalls = 0;
  let redisCalls = 0;
  await withSharedGate(async (url, options) => {
    if (String(url).endsWith('.upstash.io')) {
      const script = JSON.parse(options.body);
      const key = script[3];
      const count = (counters.get(key) ?? 0) + 1;
      counters.set(key, count);
      redisCalls += 1;
      return Response.json({ result: [count, 29] });
    }
    assert.match(String(url), /^https:\/\/api\.github\.com\/repos\/owner\/example\//);
    githubCalls += 1;
    if (String(url).includes('/actions/')) {
      return Response.json({ total_count: 0, workflow_runs: [] });
    }
    return Response.json([]);
  }, async () => {
    // One shared Redis budget for both API routes. Unlike process-local throttles,
    // Redis is consulted for the 21st request and rejects it authoritatively.
    for (let i = 1; i <= 20; i += 1) {
      const kind = i % 2 === 0 ? prsGET : actionsGET;
      const path = i % 2 === 0 ? '/api/public-prs' : '/api/public-actions';
      const response = await kind(request(path, '198.51.100.188'));
      assert.equal(response.status, 200, `request #${i}`);
    }
    const twentyFirst = await prsGET(request('/api/public-prs', '198.51.100.188'));
    assert.equal(twentyFirst.status, 429);
    assert.equal(twentyFirst.headers.get('retry-after'), '29');
    assert.equal(twentyFirst.headers.get('cache-control'), 'no-store');
    assert.equal(redisCalls, 21, 'Redis is consulted even after twenty local requests');
    assert.equal(githubCalls, 20, 'rejected request never reaches GitHub');
    assert.equal(counters.size, 1);

    const secondIp = await actionsGET(request('/api/public-actions', '198.51.100.189'));
    assert.equal(secondIp.status, 200);
    assert.equal(redisCalls, 22);
    assert.equal(githubCalls, 21);
    assert.equal(counters.size, 2);
  });
});

test('a healthy shared backend is not shadowed by the old per-instance 20/min limiter', async () => {
  let acceptedByRedis = 0;
  let upstreamCalls = 0;
  await withSharedGate(async (url) => {
    if (String(url).endsWith('.upstash.io')) {
      acceptedByRedis += 1;
      return Response.json({ result: [1, 59] });
    }
    upstreamCalls += 1;
    return Response.json({ total_count: 0, workflow_runs: [] });
  }, async () => {
    for (let i = 0; i < 23; i += 1) {
      const response = await actionsGET(request('/api/public-actions', '192.0.2.231'));
      assert.equal(response.status, 200, `distributed-backend acceptance ${i + 1}`);
    }
  });
  assert.equal(acceptedByRedis, 23, 'all requests must consult Redis');
  assert.equal(upstreamCalls, 23, 'local-only limiter must not reject when Redis allows');
});
