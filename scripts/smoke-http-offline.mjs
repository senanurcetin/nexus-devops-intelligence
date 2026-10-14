#!/usr/bin/env node
/**
 * Deterministic, CI-free origin smoke test. It intentionally never sends
 * a valid repository query, so it cannot invoke the public GitHub or Redis
 * adapters. All requests are restricted to an already running loopback server.
 *
 * Usage in an isolated checkout:
 *   npm run build
 *   npm run start
 *   npm run smoke:http:offline   # in a second terminal
 *
 * This is NOT a live GitHub smoke, a protected Preview acceptance test,
 * or evidence that shared Redis/WAF works on Vercel.
 */
import assert from 'node:assert/strict';

const base = new URL(process.env.NEXUS_BASE_URL || 'http://127.0.0.1:3000/');
if (
  base.protocol !== 'http:' ||
  !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) ||
  base.username || base.password || base.search || base.hash ||
  base.pathname !== '/'
) {
  throw new Error('Offline smoke accepts only a local HTTP loopback origin; never a Preview/Production URL.');
}

async function check(path, status, type) {
  const response = await fetch(new URL(path, base), {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, status, path + ': HTTP response');
  assert.match(response.headers.get('content-type') || '', type, path + ': MIME type');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff', path + ': nosniff');
  const body = await response.text();
  if (status === 400) {
    assert.match(response.headers.get('cache-control') || '', /no-store/i, path + ': no-store');
    const parsed = JSON.parse(body);
    assert.equal(typeof parsed.error, 'string', path + ': safe error payload');
  } else {
    assert.match(body, /NEXUS/, path + ': rendered title');
    assert.equal(response.headers.get('x-frame-options'), 'DENY', path + ': anti-framing');
    assert.match(response.headers.get('content-security-policy') || '', /frame-ancestors 'none'/, path + ': CSP');
  }
  console.log('PASS ' + status + ' ' + path);
}

await check('/', 200, /text\/html/i);
const safeTargets = [
  ['public-actions', 'repository=owner%2Fexample'],
  ['public-prs', 'repository=owner%2Fexample'],
  ['public-pr-verification', 'repository=owner%2Fexample&number=12'],
  ['public-workflow-evidence', 'repository=owner%2Fexample&id=123'],
  ['public-workflow-trends', 'repository=owner%2Fexample&end=2026-10-12'],
];
for (const [route, validQuery] of safeTargets) {
  const path = '/api/' + route + '?';
  // Invalid inputs MUST return 400 before *either* Redis admission or GitHub.
  await check(path + 'repository=not-a-repository', 400, /application\/json/i);
  await check(path + validQuery + '&repository=attacker%2Fother', 400, /application\/json/i);
  await check(path + validQuery + '&debug=1', 400, /application\/json/i);
}
console.log('PASS: sixteen loopback HTTP checks; zero intentionally valid GitHub/Upstash API requests.');
