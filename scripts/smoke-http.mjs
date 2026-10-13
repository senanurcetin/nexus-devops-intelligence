#!/usr/bin/env node
/**
 * Manual, CI-free HTTP smoke test against a running NEXUS production server.
 * Never triggers a GitHub Actions or CircleCI workflow. Public GitHub API
 * requests are sampled, may be rate limited, and incur no billed CI minutes.
 *
 * Start the application separately with `npm run start`; then execute
 * `npm run smoke:http`. Set NEXUS_BASE_URL for a reviewed preview URL.
 */
import assert from 'node:assert/strict';

const base = new URL(process.env.NEXUS_BASE_URL ?? 'http://127.0.0.1:3000');
if (!['https:', 'http:'].includes(base.protocol) ||
    (base.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) ||
    base.username || base.password || base.search || base.hash || base.pathname !== '/') {
  throw new Error('Use an HTTPS preview origin or a local HTTP origin, without credentials or paths.');
}

async function request(path, expectedStatus, contentType) {
  const response = await fetch(new URL(path, base), {
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
    redirect: 'error',
  });
  assert.equal(response.status, expectedStatus, `Unexpected HTTP status for ${path}`);
  assert.match(response.headers.get('content-type') ?? '', contentType);
  return { response, body: await response.text() };
}

const page = await request('/', 200, /text\/html/);
assert.match(page.body, /NEXUS/);
const defenses = [
  ['x-content-type-options', 'nosniff'],
  ['x-frame-options', 'DENY'],
  ['referrer-policy', 'strict-origin-when-cross-origin'],
];
for (const [name, expected] of defenses) {
  assert.equal(page.response.headers.get(name), expected, `Missing security header ${name}`);
}
assert.match(page.response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
console.log('PASS: homepage renders NEXUS with anti-framing, nosniff and referrer headers (200).');

for (const api of ['/api/public-actions', '/api/public-prs']) {
  const invalid = await request(`${api}?repository=not-a-repository`, 400, /application\/json/);
  assert.equal(typeof JSON.parse(invalid.body).error, 'string');
  assert.match(invalid.response.headers.get('cache-control') ?? '', /no-store/);
  assert.equal(invalid.response.headers.get('x-content-type-options'), 'nosniff');
  console.log(`PASS: ${api} rejects invalid repository (400, no-store).`);
}

const workflow = await request('/api/public-actions?repository=senanurcetin%2Fot-sentinel', 200, /application\/json/);
const runs = JSON.parse(workflow.body);
assert.equal(runs.repository, 'senanurcetin/ot-sentinel');
assert.ok(Number.isSafeInteger(runs.inspected_runs) && runs.inspected_runs >= 0 && runs.inspected_runs <= 10);
assert.ok(Array.isArray(runs.runs) && runs.runs.length === runs.inspected_runs);
console.log(`PASS: live workflow API returned ${runs.inspected_runs} verified sample run(s).`);

const pull = await request('/api/public-prs?repository=vercel%2Fnext.js', 200, /application\/json/);
const prs = JSON.parse(pull.body);
assert.equal(prs.repository, 'vercel/next.js');
assert.ok(Number.isSafeInteger(prs.inspected_prs) && prs.inspected_prs >= 0 && prs.inspected_prs <= 5);
assert.ok(Array.isArray(prs.pull_requests) && prs.pull_requests.length === prs.inspected_prs);
console.log(`PASS: live pull request API returned ${prs.inspected_prs} verified sample PR(s).`);

console.log('All manual HTTP smoke tests passed. CI was not used.');
