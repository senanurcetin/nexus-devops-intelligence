import test from 'node:test';
import assert from 'node:assert/strict';
import {
  safeNexusPreviewOrigin,
  probeProtectedRedisPreview,
} from '../scripts/verify-protected-redis-preview.mjs';

const preview = 'https://nexus-devops-intelligence-pr-42-senanurs-projects-102fb36c.vercel.app/';
const headers = {
  'x-nexus-rate-limit-mode': 'shared-redis',
  'x-vercel-cache': 'MISS',
};
const ok = () => new Response('{}', { status: 200, headers });
const denied = (source = 'shared-redis') => new Response('{}', {
  status: 429,
  headers: {
    'x-nexus-rate-limit-source': source,
    'retry-after': '31',
    'cache-control': 'no-store',
    'x-vercel-cache': 'MISS',
  },
});

test('probe only targets the actual NEXUS team preview namespace, never production', () => {
  assert.equal(safeNexusPreviewOrigin(preview), preview.slice(0, -1));
  for (const untrusted of [
    'https://nexus-devops-intelligence.vercel.app/',
    'https://nexus-devops-intelligence-senanurs-projects-102fb36c.vercel.app/',
    'https://nexus-devops-intelligence-git-main-senanurs-projects-102fb36c.vercel.app/',
    'https://nexus-devops-intelligence-git-main-extra-senanurs-projects-102fb36c.vercel.app/',
    'https://nexus-devops-intelligence-pr-42.vercel.app/',
    'https://nexus-devops-intelligence-pr-42-senanurs-projects-102fb36c.vercel.app.evil.test/',
    'https://nexus-devops-intelligence-pr-42-attacker.vercel.app/',
    'http://nexus-devops-intelligence-pr-42-senanurs-projects-102fb36c.vercel.app/',
    'https://user:password@nexus-devops-intelligence-pr-42-senanurs-projects-102fb36c.vercel.app/',
    'https://nexus-devops-intelligence-pr-42-senanurs-projects-102fb36c.vercel.app:8443/',
    'https://nexus-devops-intelligence-pr-42-senanurs-projects-102fb36c.vercel.app/other',
    'https://nexus-devops-intelligence-pr-42-senanurs-projects-102fb36c.vercel.app/?next=prod',
    'https://nexus-devops-intelligence-pr-42-senanurs-projects-102fb36c.vercel.app/#foo',
    'https://github.com/senanurcetin/nexus-devops-intelligence',
  ]) {
    assert.equal(safeNexusPreviewOrigin(untrusted), null, untrusted);
  }
});

test('without explicit bounded authorization the probe sends exactly one no-store GET', async () => {
  const seen = [];
  const result = await probeProtectedRedisPreview({
    url: preview, bypassToken: 'test-preview-bypass-only',
    now: () => 0,
    fetcher: async (url, options) => {
      seen.push({url, options});
      return ok();
    },
  });
  assert.equal(result.state, 'ready');
  assert.equal(result.requests, 1);
  assert.equal(result.crossInstanceVerified, false);
  assert.equal(seen.length, 1);
  assert.equal(new URL(seen[0].url).pathname, '/api/public-actions');
  assert.equal(new URL(seen[0].url).searchParams.get('repository'),
    'senanurcetin/nexus-devops-intelligence');
  assert.deepEqual([...new URL(seen[0].url).searchParams.keys()], ['repository'],
    'Preview probe must only use the single API-permitted query parameter');
  assert.equal(seen[0].options.headers['Cache-Control'], 'no-cache, no-store, max-age=0');
  assert.equal(seen[0].options.headers.Pragma, 'no-cache');
  assert.equal(seen[0].options.headers['x-vercel-protection-bypass'], 'test-preview-bypass-only');
  assert.equal(seen[0].options.cache, 'no-store');
  assert.equal(seen[0].options.redirect, 'manual');
  assert.equal(seen[0].options.method, 'GET');
  assert.doesNotMatch(JSON.stringify(result), /test-preview-bypass-only/);
});

test('21st request shared across both routes proves Redis-origin 429 but not instance count', async () => {
  const routes = [];
  let calls = 0;
  const result = await probeProtectedRedisPreview({
    url: preview, confirm21: true, now: () => 0,
    fetcher: async (url) => {
      calls++;
      routes.push(new URL(url).pathname);
      return calls === 21 ? denied() : ok();
    },
  });
  assert.equal(result.state, 'passed');
  assert.equal(result.requests, 21);
  assert.equal(result.admitted, 20);
  assert.deepEqual(result.pathsChecked, ['actions', 'prs']);
  assert.equal(result.crossInstanceVerified, false);
  assert.equal(calls, 21);
  assert.equal(routes.filter(path => path === '/api/public-actions').length, 11);
  assert.equal(routes.filter(path => path === '/api/public-prs').length, 10);
  // A request that carries an unrecognized _nexus_rate_check query is
  // rejected with HTTP 400 by the modern public API before Redis, making
  // the former test appear broken regardless of actual shared quota.
  assert.equal(calls, 21);
});

test('upstream or local 429 is not accepted as Redis proof', async () => {
  for (const source of ['local-fallback', 'github-upstream', undefined]) {
    let calls = 0;
    const result = await probeProtectedRedisPreview({
      url: preview, confirm21: true, now: () => 0,
      fetcher: async () => ++calls === 21 ? denied(source ?? '') : ok(),
    });
    assert.equal(calls, 21);
    assert.deepEqual([result.state, result.reason],
      ['inconclusive', '429-not-attributed-to-redis']);
  }
});

test('early Redis 429 remains inconclusive because quota may have prior traffic', async () => {
  let calls = 0;
  const result = await probeProtectedRedisPreview({
    url: preview, confirm21: true, now: () => 0,
    fetcher: async () => ++calls === 2 ? denied() : ok(),
  });
  assert.equal(calls, 2);
  assert.equal(result.state, 'inconclusive');
  assert.equal(result.reason, 'shared-quota-already-in-use-or-window-moved');
});

test('preview authentication and stale code stop after one harmless request', async () => {
  for (const response of [
    new Response('', { status: 302, headers: { location: 'https://vercel.com/login' } }),
    new Response('', { status: 401 }),
    new Response('', { status: 403 }),
  ]) {
    let calls = 0;
    const result = await probeProtectedRedisPreview({
      url: preview, confirm21: true,
      fetcher: async () => { calls++; return response; },
    });
    assert.equal(result.state, 'blocked');
    assert.equal(result.reason, 'preview-authentication-required');
    assert.equal(calls, 1);
  }
  const invalid = await probeProtectedRedisPreview({
    url: preview, confirm21: true, fetcher: async () => Response.json({}),
  });
  assert.equal(invalid.state, 'blocked');
  assert.equal(invalid.reason, 'redis-not-active-or-old-deployment');
});

test('CDN cache hits and overlong probes cannot prove an origin decision', async () => {
  const cached = await probeProtectedRedisPreview({
    url: preview, confirm21: true, fetcher: async () => new Response('{}', {
      status: 200, headers: { ...headers, 'x-vercel-cache': 'HIT' },
    }),
  });
  assert.equal(cached.state, 'inconclusive');
  assert.equal(cached.reason, 'edge-cache-hit-not-an-origin-proof');

  let clock = 0;
  let calls = 0;
  const stale = await probeProtectedRedisPreview({
    url: preview, confirm21: true, now: () => clock,
    fetcher: async () => { calls++; clock += 56_000; return ok(); },
  });
  assert.equal(calls, 1);
  assert.equal(stale.state, 'inconclusive');
  assert.equal(stale.reason, 'test-window-expired');
});

test('invalid URL never sends bypass token to any host', async () => {
  let calls = 0;
  const result = await probeProtectedRedisPreview({
    url: 'https://nexus-devops-intelligence-redteam.vercel.app/',
    bypassToken: 'must-not-leak',
    confirm21: true,
    fetcher: async () => { calls++; return ok(); },
  });
  assert.equal(result.state, 'blocked');
  assert.equal(calls, 0);
  assert.doesNotMatch(JSON.stringify(result), /must-not-leak/);
});

test('unavailable and malformed 429 fail instead of claiming pass', async () => {
  const unauthorized = await probeProtectedRedisPreview({
    url: preview, fetcher: async () => { throw new Error('private token details'); },
  });
  assert.equal(unauthorized.state, 'blocked');
  assert.equal(unauthorized.reason, 'network-or-auth-failure');
  assert.doesNotMatch(JSON.stringify(unauthorized), /private token/);
  for (const [name, response] of [
    ['invalid-retry',new Response('', {status: 429, headers:{
      'x-nexus-rate-limit-source':'shared-redis', 'retry-after':'999',
      'cache-control':'no-store'}})],
    ['missing-no-store',new Response('', {status: 429, headers:{
      'x-nexus-rate-limit-source':'shared-redis', 'retry-after':'30'}})],
  ]) {
    const result = await probeProtectedRedisPreview({
      url: preview, confirm21: true,
      fetcher: async () => response,
    });
    assert.equal(result.state, 'inconclusive', name);
    assert.equal(result.reason, '429-not-attributed-to-redis');
  }
});

test('both public routes in the bounded diagnostic use only one accepted repository field', async () => {
  const urls = [];
  const result = await probeProtectedRedisPreview({
    url: preview, confirm21: true, now: () => 0,
    fetcher: async (url, init) => {
      const target = new URL(url);
      urls.push(target);
      assert.equal(target.origin, new URL(preview).origin);
      assert.deepEqual([...target.searchParams.keys()], ['repository']);
      assert.equal(target.searchParams.get('repository'), 'senanurcetin/nexus-devops-intelligence');
      assert.equal(target.searchParams.has('_nexus_rate_check'), false);
      assert.equal(init.headers['Cache-Control'], 'no-cache, no-store, max-age=0');
      assert.equal(init.headers.Pragma, 'no-cache');
      return urls.length === 21 ? denied() : ok();
    },
  });
  assert.equal(result.state, 'passed');
  assert.equal(urls.length, 21);
  assert.deepEqual(new Set(urls.map(u => u.pathname)),
    new Set(['/api/public-actions', '/api/public-prs']));
});
