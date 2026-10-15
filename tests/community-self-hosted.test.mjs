import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Community standalone build is explicit, leaving Vercel defaults alone', () => {
  const config = read('next.config.mjs');
  assert.match(config, /process\.env\.NEXUS_SELF_HOSTED_BUILD === '1'/);
  assert.match(config, /output: 'standalone'/);
  const docker = read('Dockerfile');
  assert.match(docker, /NEXUS_SELF_HOSTED_BUILD=1 npm run build/);
  assert.match(docker, /npm ci --no-audit --no-fund/);
  assert.match(docker, /COPY --from=builder --chown=node:node \/app\/\.next\/standalone/);
  assert.match(docker, /^USER node$/m);
  assert.match(docker, /CMD \["node", "server\.js"\]/);
  assert.doesNotMatch(docker, /(?:GITHUB_TOKEN|GH_TOKEN|UPSTASH_REDIS_REST_TOKEN|VERCEL_TOKEN)/);
});

test('Community Compose publishes only host loopback, no Redis or secrets', () => {
  const compose = read('compose.yaml');
  assert.match(compose, /"127\.0\.0\.1:3000:3000"/);
  assert.doesNotMatch(compose, /(?:^|\s)(?:3000:3000|0\.0\.0\.0:3000:3000)/m);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /cap_drop:\s*\n\s*- ALL/);
  assert.doesNotMatch(compose, /(?:GITHUB_TOKEN|UPSTASH_REDIS_REST_TOKEN|secrets:|volumes:)/);
});

test('Community build context excludes credentials and developer-only artifacts', () => {
  const rules = new Set(read('.dockerignore').split(/\r?\n/).map(line => line.trim()));
  for (const forbidden of ['.git', '.env', '.env.*', '**/.env.*', '.npmrc',
    'node_modules', '.next', 'tests', 'docs', 'scripts', '**/*.pem']) {
    assert.ok(rules.has(forbidden), `missing .dockerignore rule: ${forbidden}`);
  }
  assert.match(read('README.md'), /COMMUNITY_SELF_HOSTED\.md/);
  assert.match(read('docs/COMMUNITY_SELF_HOSTED.md'), /NOT RUN/);
});
