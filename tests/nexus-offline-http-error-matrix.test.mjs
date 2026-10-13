import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as actionsGET } from '../src/app/api/public-actions/route.ts';
import { GET as prsGET } from '../src/app/api/public-prs/route.ts';
import { readPublicPanel } from '../src/lib/nexus-panel-request.ts';

const backend = 'https://fixture-only.upstash.io';
const syntheticToken = 'fixture-test-only-not-a-real-token';
const repo = 'owner/example';
const paths = [
  ['/api/public-actions', actionsGET],
  ['/api/public-prs', prsGET],
];

function request(path, repository = repo) {
  return new NextRequest('http://localhost:3000' + path +
    '?repository=' + encodeURIComponent(repository), {
    headers: { 'x-vercel-forwarded-for': '198.51.100.99' },
  });
}
function json(value, status = 200, headers = {}) {
  return Response.json(value, { status, headers });
}

async function withFakeRuntime(fetcher, work, config = {}) {
  const before = {
    fetch: globalThis.fetch,
    VERCEL: process.env.VERCEL,
    URL: process.env.UPSTASH_REDIS_REST_URL,
    TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  };
  const calls = [];
  process.env.VERCEL = '1';
  process.env.UPSTASH_REDIS_REST_URL = config.url ?? backend;
  process.env.UPSTASH_REDIS_REST_TOKEN = syntheticToken;
  globalThis.fetch = async (url, init) => {
    const location = String(url);
    calls.push({ location, init });
    assert.ok(location === backend || location.startsWith('https://api.github.com/repos/owner/example/'),
      'offline fixture blocked an unexpected external URL');
    return fetcher(location, init, calls);
  };
  try {
    await work(calls);
  } finally {
    globalThis.fetch = before.fetch;
    for (const [key, previous] of [
      ['VERCEL', before.VERCEL],
      ['UPSTASH_REDIS_REST_URL', before.URL],
      ['UPSTASH_REDIS_REST_TOKEN', before.TOKEN],
    ]) {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  }
}

function assertNoLeak(response, body) {
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(typeof body.error, 'string');
  assert.ok(body.error.length < 250);
  assert.doesNotMatch(JSON.stringify(body), /fixture-test-only|upstash\.io|private-error|super-secret|internal-stack/i);
}

test('offline matrix: invalid repo stops before Redis / GitHub on both routes', async () => {
  await withFakeRuntime(() => { throw Error('invalid input must make no outbound requests'); },
    async calls => {
      for (const [path, get] of paths) {
        const res = await get(request(path, '../secret'));
        assert.equal(res.status, 400);
        assertNoLeak(res, await res.json());
      }
      assert.equal(calls.length, 0);
    });
});

test('offline matrix: Redis quota 429 precedes GitHub for both public routes', async () => {
  await withFakeRuntime(url => {
    assert.equal(url, backend);
    return json({ result: [21, 33] });
  }, async calls => {
    for (const [path, get] of paths) {
      const res = await get(request(path));
      assert.equal(res.status, 429);
      assert.equal(res.headers.get('retry-after'), '33');
      assert.equal(res.headers.get('x-nexus-rate-limit-source'), 'shared-redis');
      assertNoLeak(res, await res.json());
    }
    assert.equal(calls.length, 2);
    assert.ok(calls.every(c => c.location === backend));
    assert.ok(calls.every(c => c.init.method === 'POST' && c.init.cache === 'no-store'));
  });
});

test('offline matrix: configured but failing Redis fails closed without GitHub fanout', async () => {
  const cases = [
    ['auth', () => json({ error: 'private-error' }, 401)],
    ['server', () => json({ error: 'internal-stack' }, 500)],
    ['bad-json', () => new Response('not json', { status: 200 })],
    ['malformed', () => json({ result: [20, -2] })],
    ['wrong-array', () => json({ result: ['21', '5'] })],
    ['missing-result', () => json({ error: 'super-secret' })],
    ['timeout', () => Promise.reject(new DOMException('private-error', 'TimeoutError'))],
    ['network', () => Promise.reject(new Error('super-secret private-error'))],
  ];
  for (const [name, fake] of cases) {
    await withFakeRuntime((url) => {
      assert.equal(url, backend);
      return fake();
    }, async calls => {
      for (const [path, get] of paths) {
        const res = await get(request(path));
        assert.equal(res.status, 503, name + ': ' + path);
        assert.equal(res.headers.get('retry-after'), '5');
        assert.equal(res.headers.get('x-nexus-rate-limit-source'), 'shared-redis-unavailable');
        assertNoLeak(res, await res.json());
      }
      assert.equal(calls.length, 2, 'Redis is consulted once per request; GitHub never called');
    });
  }
});

test('offline matrix: unsafe Redis URL fails closed without sending bearer token anywhere', async () => {
  await withFakeRuntime(() => { throw Error('never call fetch for invalid Redis host'); },
    async calls => {
      for (const [path, get] of paths) {
        const res = await get(request(path));
        assert.equal(res.status, 503);
        assertNoLeak(res, await res.json());
      }
      assert.equal(calls.length, 0);
    }, { url: 'https://upstash.io.attacker.invalid' });
});

test('offline matrix: after Redis admission, source-level 429 is correctly attributed', async () => {
  await withFakeRuntime(url => url === backend
    ? json({ result: [1, 40] })
    : json({ message: 'private-error upstream' }, 429, { 'Retry-After': '72' }),
  async calls => {
    for (const [path, get] of paths) {
      const res = await get(request(path));
      assert.equal(res.status, 429);
      assert.equal(res.headers.get('retry-after'), '72');
      assert.equal(res.headers.get('x-nexus-rate-limit-source'), 'github-upstream');
      assertNoLeak(res, await res.json());
    }
    assert.equal(calls.filter(x => x.location === backend).length, 2);
    assert.equal(calls.filter(x => x.location.includes('api.github.com')).length, 2);
  });
});

test('offline matrix: malformed GitHub JSON and upstream timeout fail without raw diagnostics', async () => {
  for (const [name, handler, expected] of [
    ['malformed', () => new Response('private-error not-json'), 502],
    ['timeout', () => Promise.reject(new DOMException('super-secret', 'TimeoutError')), 504],
    ['unavailable', () => json({ message: 'internal-stack' }, 503), 503],
  ]) {
    await withFakeRuntime(url => url === backend ? json({ result: [1, 40] }) : handler(),
      async calls => {
        for (const [path, get] of paths) {
          const res = await get(request(path));
          assert.equal(res.status, expected, name + ' on ' + path);
          assertNoLeak(res, await res.json());
        }
        assert.equal(calls.filter(x => x.location === backend).length, 2);
        assert.equal(calls.filter(x => x.location.includes('api.github.com')).length, 2);
      });
  }
});

test('offline matrix: browser displays known public errors but never arbitrary short diagnostics', async () => {
  const scenarios = [
    [404, 'Public repository or pull requests not found.', 'Public repository or pull requests not found.'],
    [503, 'GitHub API is currently unavailable.', 'GitHub API is currently unavailable.'],
    [503, 'Authorization Bearer super-secret', 'GitHub data is temporarily unavailable.'],
    [502, 'internal-stack', 'GitHub data is temporarily unavailable.'],
    [503, '<b>private-error</b>', 'GitHub data is temporarily unavailable.'],
  ];
  for (const [status, serverError, expected] of scenarios) {
    let calls = 0;
    const result = await readPublicPanel('/api/public-prs', new AbortController().signal,
      async (_url, init) => {
        assert.equal(init.cache, 'no-store');
        calls++;
        return json({ error: serverError }, status);
      });
    assert.equal(result.error, expected);
    assert.equal(result.data, null);
    assert.equal(calls, 1, 'never auto-retry an error');
  }
});

test('offline matrix: rate-limit adapter bounds Retry-After and never parses WAF HTML', async () => {
  for (const [wait, expected] of [['7', /wait at least 7 seconds/],
    ['70000', /try again shortly/], ['not-a-number', /try again shortly/]]) {
    let calls = 0;
    const result = await readPublicPanel('/api/public-actions', new AbortController().signal,
      async () => {
        calls++;
        return new Response('<html>private-error</html>', { status: 429, headers: { 'Retry-After': wait } });
      });
    assert.match(result.error, expected);
    assert.doesNotMatch(result.error, /private-error|html/);
    assert.equal(calls, 1);
  }
});
