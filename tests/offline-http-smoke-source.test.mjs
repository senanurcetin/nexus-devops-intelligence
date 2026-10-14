import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const script = new URL('../scripts/smoke-http-offline.mjs', import.meta.url);

/**
 * No local server is necessary: disallowed origins must fail before the
 * first fetch. This guarantees an offline test cannot accidentally target
 * an authenticated Preview/Production or a non-loopback network endpoint.
 */
test('offline HTTP smoke refuses public/Preview origins and unsafe URL forms', () => {
  for (const origin of [
    'https://nexus-devops-intelligence.vercel.app/',
    'https://nexus-devops-intelligence-qwftzbzic-senanurs-projects-102fb36c.vercel.app/',
    'http://example.com:3000/',
    'http://127.0.0.1:3000/api/public-actions',
    'http://user:secret@127.0.0.1:3000/',
    'http://127.0.0.1:3000/?repository=owner%2Frepo',
    'http://127.0.0.1:3000/#fragment',
  ]) {
    const result = spawnSync(process.execPath, [script.pathname], {
      env: { ...process.env, NEXUS_BASE_URL: origin },
      encoding: 'utf8',
      timeout: 4000,
    });
    assert.notEqual(result.status, 0, origin);
    assert.match(result.stderr, /Offline smoke accepts only a local HTTP loopback origin/);
    assert.doesNotMatch(result.stdout, /PASS 200|PASS 400/);
  }
});
