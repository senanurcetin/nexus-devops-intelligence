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

test('Community build context is default-deny and allows only build inputs', () => {
  const rules = read('.dockerignore').split(/\r?\n/)
    .map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  assert.equal(rules[0], '*', 'unknown and untracked files must be excluded by default');
  assert.deepEqual(rules.filter(rule => rule.startsWith('!')), [
    '!package.json', '!package-lock.json', '!next.config.mjs', '!next-env.d.ts',
    '!postcss.config.mjs', '!tsconfig.json', '!LICENSE',
    '!src', '!src/**', '!public', '!public/**',
  ], 'the only context exceptions must be explicit build inputs');

  const lastInclude = rules.indexOf('!public/**');
  for (const blocked of [
    '**/.env', '**/.env.*', '**/.npmrc', '**/.git/**', '**/.ssh/**',
    '**/*.pem', '**/*.key', '**/*.p12', '**/*.pfx',
    '**/credentials*.json', '**/*service-account*.json', '**/*secret*.json',
    '**/id_rsa*', '**/id_ed25519*', '**/node_modules/**', '**/.next/**',
  ]) {
    assert.ok(rules.indexOf(blocked) > lastInclude,
      'sensitive path must be excluded AFTER source re-inclusion: ' + blocked);
  }
  assert.match(read('Dockerfile'), /^COPY \. \.$/m);
  assert.match(read('README.md'), /COMMUNITY_SELF_HOSTED\.md/);
  assert.match(read('docs/COMMUNITY_SELF_HOSTED.md'), /NOT RUN/);
  assert.match(read('package.json'), /smoke:community:localhost/);
  assert.match(read('package.json'), /verify:community:runtime/);
  assert.match(read('docs/COMMUNITY_SELF_HOSTED.md'), /read-only Docker version\/config\/ps\/inspect\/port/i);
  assert.match(read('scripts/verify-community-runtime.mjs'), /verifyCommunityRuntime/);
  assert.match(read('scripts/verify-community-localhost.mjs'), /127\.0\.0\.1/);
});

test('Community Docker base image is digest pinned consistently across all stages', () => {
  const docker = read('Dockerfile');
  const bases = [...docker.matchAll(/^FROM (node:22-bookworm-slim@sha256:[a-f0-9]{64}) AS (deps|builder|runtime)$/gm)];
  assert.deepEqual(bases.map(([, , stage]) => stage), ['deps', 'builder', 'runtime']);
  assert.equal(new Set(bases.map(([, source]) => source)).size, 1,
    'All stages must use the same immutable official Node image index');
  assert.equal(bases.length, 3);
});
