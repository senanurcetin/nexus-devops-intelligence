import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as actionsGET } from '../src/app/api/public-actions/route.ts';
import { GET as prsGET } from '../src/app/api/public-prs/route.ts';

const repo = 'owner/example';
const fixtureRedis = 'https://nexus-budget-fixture.upstash.io';
const fakeBearer = 'local-budget-fixture-not-a-live-secret';
const request = kind => new NextRequest(
  'http://localhost:3000/api/public-' + kind + '?repository=owner%2Fexample',
  { headers: { 'x-vercel-forwarded-for': '198.51.100.73' } },
);
const validPR = n => ({
  number: n,
  title: 'Source PR ' + n,
  draft: false,
  updated_at: '2026-10-13T12:00:00Z',
  html_url: 'https://github.com/' + repo + '/pull/' + n,
  user: { login: 'contributor' },
});
const prDetail = n => ({
  number: n,
  mergeable_state: 'clean',
  mergeable: true,
  html_url: 'https://github.com/' + repo + '/pull/' + n,
});
const response = (body, status = 200, headers = {}) =>
  Response.json(body, { status, headers });

/**
 * All origin-like requests are intercepted before network. Synthetic .upstash
 * endpoint and synthetic token are never sent to Upstash or saved as secrets.
 */
async function withOfflineOrigin(fakeGitHub, work) {
  const prev = {
    fetch: globalThis.fetch,
    vercel: process.env.VERCEL,
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  };
  const calls = { redis: [], github: [] };
  process.env.VERCEL = '1';
  process.env.UPSTASH_REDIS_REST_URL = fixtureRedis;
  process.env.UPSTASH_REDIS_REST_TOKEN = fakeBearer;
  globalThis.fetch = async (url, options) => {
    const target = String(url);
    if (target === fixtureRedis) {
      assert.equal(options.method, 'POST');
      assert.equal(options.cache, 'no-store');
      assert.equal(options.headers.Authorization, 'Bearer ' + fakeBearer);
      const command = JSON.parse(options.body);
      assert.equal(command[0], 'EVAL');
      calls.redis.push(command);
      return response({ result: [1, 48] });
    }
    assert.match(target, /^https:\/\/api\.github\.com\/repos\/owner\/example\//);
    calls.github.push(target);
    return fakeGitHub(target, options, calls);
  };
  try { return await work(calls); } finally {
    globalThis.fetch = prev.fetch;
    for (const [name, value] of [
      ['VERCEL', prev.vercel],
      ['UPSTASH_REDIS_REST_URL', prev.url],
      ['UPSTASH_REDIS_REST_TOKEN', prev.token],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('Q-05: one repository refresh uses 2 shared Redis decisions and at most 7 GitHub GETs', async () => {
  let active = 0;
  let maxActive = 0;
  await withOfflineOrigin(async url => {
    if (url.includes('/actions/runs?')) {
      return response({ total_count: 0, workflow_runs: [] });
    }
    if (url.includes('/pulls?')) {
      return response(Array.from({ length: 5 }, (_, n) => validPR(n + 1)));
    }
    assert.match(url, /\/pulls\/[1-5]$/);
    active++;
    maxActive = Math.max(active, maxActive);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    return response(prDetail(Number(url.split('/').at(-1))));
  }, async calls => {
    const [actions, prs] = await Promise.all([
      actionsGET(request('actions')), prsGET(request('prs')),
    ]);
    assert.equal(actions.status, 200);
    assert.equal(prs.status, 200);
    assert.equal((await actions.json()).inspected_runs, 0);
    assert.equal((await prs.json()).inspected_prs, 5);
    assert.equal(calls.redis.length, 2, 'one Redis admission per origin route invocation');
    assert.equal(calls.github.length, 7, '1 workflow + 1 PR list + 5 PR detail GETs');
    assert.equal(calls.github.filter(u => u.includes('/actions/runs?')).length, 1);
    assert.equal(calls.github.filter(u => u.includes('/pulls?')).length, 1);
    assert.equal(maxActive, 2, 'no more than two PR details in flight');
    assert.equal(new Set(calls.redis.map(cmd => cmd[3])).size, 1,
      'both routes share an opaque per-IP Redis bucket');
  });
});

test('Q-05: two concurrent identical Actions requests consume their own admissions but dedupe upstream', async () => {
  await withOfflineOrigin(async url => {
    assert.match(url, /\/actions\/runs\?/);
    await new Promise(resolve => setImmediate(resolve));
    return response({ total_count: 0, workflow_runs: [] });
  }, async calls => {
    const [a, b] = await Promise.all([actionsGET(request('actions')), actionsGET(request('actions'))]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(calls.redis.length, 2);
    assert.equal(calls.github.length, 1, 'concurrent same-source actions must share one GitHub GET');
  });
});

test('Q-05: upstream PR list rate limit must prevent all 5 detail requests and auto retries', async () => {
  await withOfflineOrigin(async url => {
    assert.match(url, /\/pulls\?/);
    return response({ message: 'private upstream quota detail' }, 429,
      { 'Retry-After': '47' });
  }, async calls => {
    const r = await prsGET(request('prs'));
    assert.equal(r.status, 429);
    assert.equal(r.headers.get('x-nexus-rate-limit-source'), 'github-upstream');
    assert.equal(r.headers.get('retry-after'), '47');
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(calls.redis.length, 1);
    assert.equal(calls.github.length, 1, 'no detail fanout or automatic retry');
    assert.doesNotMatch(JSON.stringify(await r.json()), /private upstream/);
  });
});
