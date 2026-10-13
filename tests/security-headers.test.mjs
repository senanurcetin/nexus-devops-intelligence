import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../next.config.mjs';

test('security headers: homepage, assets and public APIs inherit configured defenses', async () => {
  const rules = await config.headers();
  assert.equal(rules.length, 1);
  assert.equal(rules[0].source, '/:path*');
  const entries = new Map(rules[0].headers.map(h => [h.key.toLowerCase(), h.value]));
  assert.equal(entries.get('x-content-type-options'), 'nosniff');
  assert.equal(entries.get('x-frame-options'), 'DENY');
  assert.equal(entries.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.match(entries.get('permissions-policy'), /geolocation=\(\)/);
  assert.match(entries.get('permissions-policy'), /microphone=\(\)/);
  assert.match(entries.get('permissions-policy'), /camera=\(\)/);
  assert.match(entries.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(entries.get('content-security-policy'), /object-src 'none'/);
  assert.match(entries.get('content-security-policy'), /base-uri 'self'/);
});

test('security headers: no wildcard CORS, secrets or unsupported full-script CSP promises', async () => {
  const rules = await config.headers();
  const entries = new Map(rules[0].headers.map(h => [h.key.toLowerCase(), h.value]));
  assert.ok(!entries.has('access-control-allow-origin'));
  assert.ok(!entries.has('authorization'));
  assert.doesNotMatch(entries.get('content-security-policy'), /unsafe-inline|unsafe-eval|default-src|script-src/);
  assert.equal(new Set([...entries.keys()]).size, entries.size);
});
