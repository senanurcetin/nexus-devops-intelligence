import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Local-only safety smoke. Intentionally uses malformed repository parameters
// so a successful test makes ZERO upstream GitHub API requests.
export const communityInvalidRoutes = [
  '/api/public-actions',
  '/api/public-prs',
  '/api/public-pr-verification',
  '/api/public-workflow-evidence',
  '/api/public-workflow-trends',
];

export function validateLocalPort(value) {
  const text = String(value);
  if (!/^[1-9][0-9]{0,4}$/.test(text)) {
    throw new Error('Port must be a decimal integer between 1 and 65535.');
  }
  const port = Number(text);
  if (port > 65535) throw new Error('Port must be between 1 and 65535.');
  return port;
}

export async function verifyCommunityLocalhost({ port = 3000, fetchImpl = fetch } = {}) {
  const localPort = validateLocalPort(port);
  const origin = `http://127.0.0.1:${localPort}`;
  const visited = [];

  async function get(path) {
    const response = await fetchImpl(`${origin}${path}`, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    const name = path.split('?')[0];
    assert.equal(response.headers.get('x-frame-options'), 'DENY', `${name}: frame header`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', `${name}: MIME header`);
    visited.push({ path: name, status: response.status });
    return response;
  }

  const root = await get('/');
  assert.equal(root.status, 200, 'homepage must return HTTP 200');

  for (const path of communityInvalidRoutes) {
    const response = await get(`${path}?repository=invalid-repo`);
    assert.equal(response.status, 400, `${path}: invalid repository must return 400`);
    assert.match(response.headers.get('cache-control') || '', /no-store/i,
      `${path}: invalid result must disable caching`);
  }
  return visited;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyCommunityLocalhost({ port: process.argv[2] ?? 3000 }).then(rows => {
    for (const row of rows) console.log(`PASS ${row.status} ${row.path}`);
    console.log('Community localhost smoke passed: 6 local requests; 0 GitHub API requests.');
  }).catch(error => {
    console.error(`FAIL Community localhost smoke: ${error.message}`);
    process.exitCode = 1;
  });
}
