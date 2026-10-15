import test from 'node:test';
import assert from 'node:assert/strict';
import {
  communityInvalidRoutes, validateLocalPort, verifyCommunityLocalhost,
} from '../scripts/verify-community-localhost.mjs';

test('Community local smoke only reaches 127.0.0.1, with invalid repo parameters', async () => {
  const requested = [];
  const headers = { 'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff' };
  const fetchImpl = async (url, options) => {
    const parsed = new URL(url);
    requested.push(parsed);
    assert.equal(parsed.hostname, '127.0.0.1');
    assert.equal(parsed.port, '3001');
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    if (parsed.pathname === '/') return new Response('home', { status: 200, headers });
    assert.equal(parsed.searchParams.get('repository'), 'invalid-repo');
    assert.ok(communityInvalidRoutes.includes(parsed.pathname));
    return new Response('{}', {
      status: 400, headers: { ...headers, 'cache-control': 'no-store' },
    });
  };
  const result = await verifyCommunityLocalhost({ port: 3001, fetchImpl });
  assert.equal(result.length, 6);
  assert.equal(requested.length, 6);
});

test('Community local smoke fails closed on wrong status or cache headers', async () => {
  const headers = { 'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff' };
  const fetchImpl = async url => new Response('{}', {
    status: new URL(url).pathname === '/' ? 200 : 503, headers,
  });
  await assert.rejects(() => verifyCommunityLocalhost({ fetchImpl }), /invalid repository must return 400/);
});

test('Community local smoke rejects host/URL injection in port parameter', () => {
  for (const bad of ['0', '65536', '3000/path', '127.0.0.1:3000', '-1', '03000', '']) {
    assert.throws(() => validateLocalPort(bad), /Port must/);
  }
  assert.equal(validateLocalPort('3000'), 3000);
});
