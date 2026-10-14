import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as actionsGET } from '../src/app/api/public-actions/route.ts';
import { GET as prsGET } from '../src/app/api/public-prs/route.ts';
import { GET as verifyGET } from '../src/app/api/public-pr-verification/route.ts';
import { GET as evidenceGET } from '../src/app/api/public-workflow-evidence/route.ts';
import { GET as trendsGET } from '../src/app/api/public-workflow-trends/route.ts';

const origin = 'http://127.0.0.1:3000';
const repository = 'owner/example';
const query = 'repository=owner%2Fexample';
const routes = [
  {path:'/api/public-actions', GET:actionsGET, valid:query},
  {path:'/api/public-prs', GET:prsGET, valid:query},
  {path:'/api/public-pr-verification', GET:verifyGET, valid:query+'&number=12'},
  {path:'/api/public-workflow-evidence', GET:evidenceGET, valid:query+'&id=123'},
  // Intentionally invalid date is fine for the Redis rejection cases, but
  // on the 2026-10-14 acceptance checkpoint this is a completed UTC day.
  {path:'/api/public-workflow-trends', GET:trendsGET, valid:query+'&end=2026-10-12'},
];
const testIp = '203.0.113.83';
const envNames = ['VERCEL','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'];
const mockEndpoint = 'https://nexus-5-route-test.upstash.io';
function makeRequest(path, params) {
  return new NextRequest(origin + path + '?' + params,
    {headers:{'x-vercel-forwarded-for':testIp}});
}
async function withFakeRedis(fetcher, work, overrides={}) {
  const previousEnv = Object.fromEntries(envNames.map(key=>[key,process.env[key]]));
  const previousFetch = globalThis.fetch;
  process.env.VERCEL = '1';
  process.env.UPSTASH_REDIS_REST_URL = mockEndpoint;
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token-only';
  Object.assign(process.env,overrides);
  globalThis.fetch = fetcher;
  try { return await work(); }
  finally {
    globalThis.fetch = previousFetch;
    for (const key of envNames) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
  }
}

test('all five routes: duplicate source and unexpected query fields fail 400 without Redis/GitHub', async () => {
  const attempts = [];
  const unexpectedFetch = async url => {
    attempts.push(String(url));
    throw Error('Invalid request reached an external data source');
  };
  await withFakeRedis(unexpectedFetch, async () => {
    for (const {path,GET,valid} of routes) {
      for (const invalid of [
        valid+'&repository=attacker%2Fother',
        valid+'&debug=1',
        valid.replace('owner%2Fexample','bad-repository'),
        valid+'&repository=owner%2Fexample',
        '',
      ]) {
        const response = await GET(makeRequest(path,invalid));
        assert.equal(response.status,400, path+' query '+invalid);
        assert.equal(response.headers.get('cache-control'),'no-store');
        assert.equal(response.headers.get('x-nexus-rate-limit-source'),null);
        assert.equal(typeof (await response.json()).error,'string');
      }
    }
  });
  assert.deepEqual(attempts,[], 'invalid sources must not spend Redis or GitHub quota');
});

test('all five routes: atomic shared Redis 21st count blocks before GitHub with attributed 429', async () => {
  const requests=[];
  await withFakeRedis(async (url, init) => {
    assert.equal(String(url),mockEndpoint);
    const cmd = JSON.parse(init.body);
    assert.equal(cmd[0],'EVAL');
    assert.equal(cmd[2],1);
    requests.push(cmd);
    return Response.json({result:[21,17]});
  }, async () => {
    for (const {path,GET,valid} of routes) {
      const response = await GET(makeRequest(path,valid));
      assert.equal(response.status,429,path);
      assert.equal(response.headers.get('cache-control'),'no-store');
      assert.equal(response.headers.get('retry-after'),'17');
      assert.equal(response.headers.get('x-nexus-rate-limit-source'),'shared-redis');
      assert.match((await response.json()).error,/limit/i);
    }
  });
  assert.equal(requests.length,5,'one Upstash EVAL request per valid origin request');
  assert.ok(requests.every(cmd=>cmd[3]===requests[0][3]),
    'five API routes must share the same opaque per-source Redis bucket');
  assert.doesNotMatch(requests[0][3],/203\.0\.113\.83/);
});

test('all five routes: failed shared Redis gate returns 503/no-store with no GitHub fallback', async () => {
  let calls = 0;
  await withFakeRedis(async url => {
    calls++;
    assert.equal(String(url),mockEndpoint,'never fall through to GitHub');
    return Response.json({error:'unavailable'}, {status:503});
  }, async () => {
    for (const {path,GET,valid} of routes) {
      const response = await GET(makeRequest(path,valid));
      assert.equal(response.status,503,path);
      assert.equal(response.headers.get('cache-control'),'no-store');
      assert.equal(response.headers.get('retry-after'),'5');
      assert.equal(response.headers.get('x-nexus-rate-limit-source'),'shared-redis-unavailable');
      assert.match((await response.json()).error,/temporarily unavailable/i);
    }
  });
  assert.equal(calls,5);
});

test('all five routes: partial Redis credentials fail closed before network', async () => {
  let calls=0;
  await withFakeRedis(async () => {
    calls++;
    throw Error('should never reach network');
  }, async () => {
    for (const {path,GET,valid} of routes) {
      const response = await GET(makeRequest(path,valid));
      assert.equal(response.status,503,path);
      assert.equal(response.headers.get('x-nexus-rate-limit-source'),'shared-redis-unavailable');
      assert.equal(response.headers.get('cache-control'),'no-store');
    }
  }, {'UPSTASH_REDIS_REST_TOKEN':''});
  assert.equal(calls,0);
});

test('source validation runs before Redis admission even if its endpoint is malformed', async () => {
  let calls=0;
  await withFakeRedis(async () => {
    calls++;
    throw Error('never call this');
  }, async () => {
    for (const {path,GET,valid} of routes) {
      const invalid = makeRequest(path, valid+'&repository=x%2Fy');
      const response = await GET(invalid);
      assert.equal(response.status,400);
      const validResponse = await GET(makeRequest(path,valid));
      assert.equal(validResponse.status,503);
      assert.equal(validResponse.headers.get('x-nexus-rate-limit-source'),'shared-redis-unavailable');
    }
  }, {'UPSTASH_REDIS_REST_URL':'https://upstash.io.attacker.invalid'});
  assert.equal(calls,0);
});
