import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as actionsGET } from '../src/app/api/public-actions/route.ts';
import { GET as pullsGET } from '../src/app/api/public-prs/route.ts';
import { coordinatePublicQuery } from '../src/lib/nexus-public-gate.ts';

// These are Next.js route-handler tests: requests pass through actual NextRequest
// and NextResponse. Outbound calls are intercepted locally; no CI is invoked.
const repository = 'owner/example';
const api = 'http://localhost:3000';
function request(path, repo = repository) {
  return new NextRequest(`${api}${path}?repository=${encodeURIComponent(repo)}`);
}
function fakeResponse(status, data, headers = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json', ...headers },
  });
}
function withMockGitHub(handler, fn) {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    assert.match(String(url), /^https:\/\/api\.github\.com\/repos\/owner\/example\//);
    assert.equal(options.headers['User-Agent'], 'nexus-devops-intelligence-public-preview');
    assert.equal(options.next.revalidate, 120);
    return handler(String(url), options, calls.length);
  };
  return Promise.resolve().then(() => fn(calls)).finally(() => { globalThis.fetch = previous; });
}

test('Next routes: invalid repositories return 400, no-store, and no upstream GET', async () => {
  await withMockGitHub(() => { throw new Error('should not fetch'); }, async calls => {
    for (const [route, GET] of [['/api/public-actions', actionsGET], ['/api/public-prs', pullsGET]]) {
      const response = await GET(request(route, 'not a repository'));
      assert.equal(response.status, 400);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.match((await response.json()).error, /repository/i);
    }
    assert.equal(calls.length, 0);
  });
});

test('Next Actions route: actual NextResponse has sample, success cache and one fetch', async () => {
  const workflow = {
    id: 7, name: 'Checks', status: 'completed', conclusion: 'success',
    event: 'push', created_at: '2026-10-12T12:00:00Z',
    html_url: 'https://github.com/owner/example/actions/runs/7',
  };
  await withMockGitHub(() => fakeResponse(200, { total_count: 1, workflow_runs: [workflow] }), async calls => {
    const response = await actionsGET(request('/api/public-actions'));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control') ?? '', /max-age=60/);
    assert.equal(response.headers.get('content-type')?.startsWith('application/json'), true);
    const body = await response.json();
    assert.equal(body.repository, repository);
    assert.equal(body.inspected_runs, 1);
    assert.equal(body.runs[0].id, 7);
    assert.equal(calls.length, 1);
  });
});

test('Next Actions route: upstream 404, 429, 403 quota, 503, malformed JSON and timeout', async () => {
  const cases = [
    { response: () => fakeResponse(404, {}), status: 404 },
    { response: () => fakeResponse(429, {}), status: 429 },
    { response: () => fakeResponse(403, {}, { 'x-ratelimit-remaining': '0' }), status: 429 },
    { response: () => fakeResponse(503, {}), status: 503 },
    { response: () => new Response('not json', { status: 200 }), status: 502 },
    { response: () => { throw new DOMException('timeout', 'TimeoutError'); }, status: 504 },
  ];
  for (const item of cases) {
    await withMockGitHub(item.response, async calls => {
      const response = await actionsGET(request('/api/public-actions'));
      assert.equal(response.status, item.status);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(typeof (await response.json()).error, 'string');
      assert.equal(calls.length, 1);
    });
  }
});

test('Next PR route: 1 list + 2 details, draft skipped, conflict and unknown are explicit', async () => {
  const pr = (n, draft = false) => ({
    number: n, title: 'Example', draft, updated_at: '2026-10-12T12:00:00Z',
    html_url: `https://github.com/owner/example/pull/${n}`,
    user: { login: 'maintainer' },
  });
  await withMockGitHub(url => {
    if (url.includes('?state=open')) return fakeResponse(200, [pr(1, true), pr(2), pr(3)]);
    if (url.endsWith('/pulls/2')) return fakeResponse(200, {
      number: 2, mergeable: false, mergeable_state: 'dirty',
      html_url: 'https://github.com/owner/example/pull/2',
    });
    if (url.endsWith('/pulls/3')) return fakeResponse(429, {});
    throw new Error('unexpected REST request');
  }, async calls => {
    const response = await pullsGET(request('/api/public-prs'));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control') ?? '', /max-age=60/);
    const data = await response.json();
    assert.equal(data.inspected_prs, 3);
    assert.deepEqual(data.pull_requests.map(p => p.attention), ['draft', 'conflict', 'unknown']);
    assert.equal(calls.length, 3);
    assert.ok(!calls.some(c => c.url.endsWith('/pulls/1')));
  });
});

test('Next PR route: upstream errors and invalid response never become merge success', async () => {
  const cases = [
    { response: () => fakeResponse(404, {}), status: 404 },
    { response: () => fakeResponse(429, {}), status: 429 },
    { response: () => fakeResponse(503, {}), status: 503 },
    { response: () => fakeResponse(200, { not: 'an array' }), status: 502 },
    { response: () => { throw new DOMException('timeout', 'TimeoutError'); }, status: 504 },
  ];
  for (const item of cases) {
    await withMockGitHub(item.response, async calls => {
      const response = await pullsGET(request('/api/public-prs'));
      assert.equal(response.status, item.status);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(typeof (await response.json()).error, 'string');
      assert.equal(calls.length, 1);
    });
  }
});

test('Next routes: 429 sends bounded Retry-After and no-store on both APIs', async () => {
  await withMockGitHub(() => fakeResponse(429, {}, { 'Retry-After': '75' }), async calls => {
    for (const [path, GET] of [['/api/public-actions', actionsGET], ['/api/public-prs', pullsGET]]) {
      const response = await GET(request(path));
      assert.equal(response.status, 429);
      assert.equal(response.headers.get('retry-after'), '75');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.match((await response.json()).error, /rate limit/i);
    }
    assert.equal(calls.length, 2);
  });
});

test('Next routes: malformed Retry-After is not echoed', async () => {
  await withMockGitHub(() => fakeResponse(429, {}, { 'Retry-After': '99999999' }), async () => {
    for (const [path, GET] of [['/api/public-actions', actionsGET], ['/api/public-prs', pullsGET]]) {
      const response = await GET(request(path));
      assert.equal(response.status, 429);
      assert.equal(response.headers.get('retry-after'), null);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  });
});

test('Next routes: invalid inputs remain HTTP 400 even when all in-flight slots are busy', async () => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const occupied = Array.from({ length: 12 }, (_, n) =>
    coordinatePublicQuery(`actions:occupy-${n}`, async () => {
      await hold;
      return { status: 200, body: { inspected_runs: 0 } };
    }));
  try {
    await withMockGitHub(() => { throw new Error('invalid request reached GitHub'); }, async calls => {
      for (const [path, GET] of [['/api/public-actions', actionsGET], ['/api/public-prs', pullsGET]]) {
        for (const bad of ['bad repo name', 'a'.repeat(500), '../x', 'owner/.']) {
          const response = await GET(request(path, bad));
          assert.equal(response.status, 400, `${path} must reject ${bad.slice(0, 25)} before gate`);
          assert.equal(response.headers.get('cache-control'), 'no-store');
          assert.match((await response.json()).error, /owner\/name/i);
        }
      }
      assert.equal(calls.length, 0, 'invalid values must never reach GitHub');
    });
  } finally {
    release();
    await Promise.all(occupied);
  }
});

test('Next Actions route: valid overload is 503/no-store, then recovers after slots release', async () => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const occupied = Array.from({ length: 12 }, (_, n) =>
    coordinatePublicQuery(`prs:hold-${n}`, async () => {
      await hold;
      return { status: 200, body: { inspected_prs: 0 } };
    }));
  try {
    await withMockGitHub(() => { throw new Error('gate allowed overload'); }, async calls => {
      const response = await actionsGET(request('/api/public-actions'));
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.match((await response.json()).error, /temporarily busy/i);
      assert.equal(calls.length, 0);
    });
  } finally {
    release();
    await Promise.all(occupied);
  }
  await withMockGitHub(() => fakeResponse(200, { total_count: 0, workflow_runs: [] }), async calls => {
    const restored = await actionsGET(request('/api/public-actions'));
    assert.equal(restored.status, 200);
    assert.equal(calls.length, 1);
  });
});
