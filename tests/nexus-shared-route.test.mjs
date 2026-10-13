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
