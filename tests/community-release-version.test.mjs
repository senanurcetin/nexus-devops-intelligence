import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Community candidate version remains consistent and unpublished', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, lock.version);
  assert.equal(pkg.version, lock.packages[''].version);
  assert.equal(pkg.private, true, 'the source-only community build must not be npm-published');
  const policy = read('docs/COMMUNITY_VERSIONING_AND_INSTALLATION.md');
  assert.match(policy, /UNRELEASED \/ NO-GO/);
  assert.match(policy, /full 40-character/i);
  assert.match(policy, /package-lock\.json/);
  assert.match(policy, /NOT RUN/);
  assert.match(policy, /git checkout --detach/);
});

test('Docker-only install docs include host-side smoke and shutdown without npm', () => {
  const policy = read('docs/COMMUNITY_VERSIONING_AND_INSTALLATION.md');
  const guide = read('docs/COMMUNITY_SELF_HOSTED.md');
  assert.match(policy, /does not need Node\.js\/npm installed on the host/);
  assert.match(policy, /curl\.exe/);
  assert.match(policy, /docker compose port nexus 3000/);
  assert.match(policy, /docker compose down/);
  assert.match(guide, /Node\.js is optional on the Docker host/);
  assert.match(guide, /curl\.exe/);
  assert.match(guide, /COMMUNITY_VERSIONING_AND_INSTALLATION\.md/);
});
