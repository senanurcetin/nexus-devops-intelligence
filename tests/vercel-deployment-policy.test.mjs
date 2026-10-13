import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('NEXUS Vercel Git integration never triggers automatic preview or production builds', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.$schema, 'https://openapi.vercel.sh/vercel.json');
  assert.equal(config.git?.deploymentEnabled, false);
  assert.deepEqual(Object.keys(config).sort(), ['$schema', 'git']);
  assert.deepEqual(Object.keys(config.git), ['deploymentEnabled']);
});
