import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/public-commit-checks/route.ts';

const origin = 'http://127.0.0.1:3000';
const repo = 'owner/example';
const sha = 'a'.repeat(40);
const q = (extra = '') => `repository=owner%2Fexample&sha=${sha}${extra}`;
const call = (params, ip = '203.0.113.7') =>
  GET(new NextRequest(`${origin}/api/public-commit-checks?${params}`, { headers: { 'x-forwarded-for': ip } }));
const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status, headers: { 'Content-Type': 'application/json' },
});
const run = (name, status, conclusion) => ({
  id: name.length + status.length, head_sha: sha, name, status, conclusion, app: { slug: 'github-actions' },
});
const complete = {
  checks: { total_count: 1, check_runs: [{ ...run('Tests', 'completed', 'success'), id: 1 }] },
  status: { sha, total_count: 1, statuses: [{ context: 'ci/x', state: 'success' }] },
};
const route = (map) => async (url, init) => {
  fetchCalls.push({ url: String(url), init });
  const kind = String(url).includes('/check-runs?') ? 'checks' : 'status';
  const r = map[kind];
  return typeof r === 'function' ? r() : json(r.body ?? r, r.status ?? 200);
};
let fetchCalls = [];
async function withEnv(env, fetcher, work) {
  const names = ['VERCEL', 'NEXUS_PUBLIC_COMMIT_CHECKS', 'NEXUS_GITHUB_TOKEN', 'NEXUS_DEVOPS_ALLOW_GITHUB_TOKEN',
    'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
  const prev = Object.fromEntries(names.map(n => [n, process.env[n]]));
  const prevFetch = globalThis.fetch;
  for (const n of names) delete process.env[n];
  Object.assign(process.env, env);
  fetchCalls = [];
  globalThis.fetch = fetcher;
  try { return await work(); } finally {
    globalThis.fetch = prevFetch;
    for (const n of names) prev[n] === undefined ? delete process.env[n] : (process.env[n] = prev[n]);
  }
}

test('invalid parameters fail 400 no-store before any upstream call', async () => {
  await withEnv({}, route({}), async () => {
    for (const params of [
      '', `repository=owner%2Fexample`, `sha=${sha}`, q(`&sha=${sha}`), q('&repository=a%2Fb'), q('&debug=1'),
      `repository=bad&sha=${sha}`, `repository=..%2Fx&sha=${sha}`,
      `repository=owner%2Fexample&sha=main`, `repository=owner%2Fexample&sha=${'a'.repeat(39)}`,
      `repository=owner%2Fexample&sha=${'g'.repeat(40)}`, `repository=owner%2Fexample&sha=`,
    ]) {
      const res = await call(params);
      assert.equal(res.status, 400, params);
      assert.equal(res.headers.get('Cache-Control'), 'no-store');
    }
    assert.equal(fetchCalls.length, 0);
  });
});

test('uppercase PR head SHA is normalized and exactly two anonymous GETs are made', async () => {
  await withEnv({}, route(complete), async () => {
    const res = await call(`repository=owner%2Fexample&sha=${'A'.repeat(40)}`, '203.0.113.8');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.commit_sha, sha);
    assert.equal(body.coverage, 'both_sources');
    assert.equal(fetchCalls.length, 2);
    assert.ok(fetchCalls.every(c => c.url.includes('/commits/' + sha + '/')));
  });
});

test('operator GitHub token env vars never reach the web route', async () => {
  await withEnv({ NEXUS_GITHUB_TOKEN: 'ghp_must_not_be_sent', NEXUS_DEVOPS_ALLOW_GITHUB_TOKEN: '1' },
    route(complete), async () => {
      assert.equal((await call(q(), '203.0.113.9')).status, 200);
      assert.equal(fetchCalls.length, 2);
      for (const c of fetchCalls) {
        assert.ok(!('Authorization' in c.init.headers));
        assert.ok(!JSON.stringify(c.init).includes('ghp_must_not_be_sent'));
      }
    });
});

test('complete settled evidence is cacheable; pending, truncated and partial evidence is not', async () => {
  const cases = [
    [complete, 200, true],
    [{ ...complete, checks: { total_count: 1, check_runs: [{ ...run('Compile', 'in_progress', null), id: 2 }] } }, 200, false],
    [{ ...complete, checks: { total_count: 150, check_runs: complete.checks.check_runs } }, 200, false],
    [{ ...complete, status: { status: 500, body: {} } }, 200, false],
  ];
  let i = 0;
  for (const [map, status, cacheable] of cases) {
    await withEnv({}, route(map), async () => {
      const res = await call(q(), `203.0.113.${20 + i++}`);
      assert.equal(res.status, status);
      assert.equal(res.headers.get('Cache-Control') !== 'no-store', cacheable);
    });
  }
});

test('partial coverage is explicit and never reported as both sources', async () => {
  await withEnv({}, route({ ...complete, status: { status: 500, body: {} } }), async () => {
    const body = await (await call(q(), '203.0.113.40')).json();
    assert.equal(body.coverage, 'checks_only');
    assert.equal(body.sources.commit_statuses, 'unavailable');
  });
});

test('no verified source maps to 429, 404 or 502 and never to success', async () => {
  const cases = [
    [{ checks: { status: 403, body: {} }, status: { status: 403, body: {} } }, 429],
    [{ checks: { status: 404, body: {} }, status: { status: 404, body: {} } }, 404],
    [{ checks: { status: 500, body: {} }, status: { status: 404, body: {} } }, 502],
    [{ checks: () => new Response('<html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
       status: { status: 500, body: {} } }, 502],
  ];
  let i = 0;
  for (const [map, expected] of cases) {
    await withEnv({}, route(map), async () => {
      const res = await call(q(), `203.0.113.${60 + i++}`);
      assert.equal(res.status, expected);
      assert.equal(res.headers.get('Cache-Control'), 'no-store');
    });
  }
});

test('hosted deployments are disabled by default and need an explicit opt-in', async () => {
  await withEnv({ VERCEL: '1' }, route(complete), async () => {
    const res = await call(q(), '203.0.113.80');
    assert.equal(res.status, 404);
    assert.equal(fetchCalls.length, 0);
  });
  await withEnv({ VERCEL: '1', NEXUS_PUBLIC_COMMIT_CHECKS: '1' }, route(complete), async () => {
    const res = await call(q(), '203.0.113.81');
    assert.equal(res.status, 200);
  });
});

test('identical concurrent lookups share one pair of upstream requests', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const slow = async (url, init) => { fetchCalls.push({ url: String(url), init }); await gate;
    return String(url).includes('/check-runs?') ? json(complete.checks) : json(complete.status); };
  await withEnv({}, slow, async () => {
    const a = call(q(), '203.0.113.90');
    const b = call(q(), '203.0.113.91');
    await new Promise(r => setTimeout(r, 20));
    release();
    const [ra, rb] = await Promise.all([a, b]);
    assert.equal(ra.status, 200); assert.equal(rb.status, 200);
    assert.equal(fetchCalls.length, 2);
  });
});
