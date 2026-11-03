import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCommunityLedger } from '../scripts/verify-codex-community-ledger.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const original = JSON.parse(readFileSync(resolve(ROOT, 'docs/codex-community-ledger.json'), 'utf8'));
const copy = () => structuredClone(original);
const check = (input) => validateCommunityLedger(input, { root: ROOT });

test('the six-month independent ledger is valid without inventing external sharing', () => {
  assert.deepEqual(check(copy()), []);
  assert.equal(original.months.length, 6);
  assert.equal(original.months[0].status, 'PUBLISHED_IN_REPO');
  assert.equal(original.months.filter(x => x.share_url !== null).length, 0);
});

test('missing, duplicate or out-of-order months fail closed', () => {
  const missing = copy();
  missing.months.pop();
  assert.match(check(missing).join(' '), /exactly six/);
  const duplicate = copy();
  duplicate.months[1].month = '2026-11';
  assert.match(check(duplicate).join(' '), /must be 2026-12/);
});

test('draft, published and shared states require real artifact provenance', () => {
  const published = copy();
  published.months[1].status = 'PUBLISHED_IN_REPO';
  assert.match(check(published).join(' '), /requires an artifact/);
  const draft = copy();
  draft.months[1].status = 'DRAFT';
  assert.match(check(draft).join(' '), /requires an artifact/);
});

test('traversal and non-existent artifacts are rejected', () => {
  const traversed = copy();
  traversed.months[0].artifact = 'docs/../../private.md';
  assert.match(check(traversed).join(' '), /repository-relative/);
  const missing = copy();
  missing.months[0].artifact = 'docs/CODEX_DOES_NOT_EXIST.md';
  assert.match(check(missing).join(' '), /does not exist/);
});

test('a repo publication cannot pretend to have an external community share', () => {
  const inflated = copy();
  inflated.months[0].share_url = 'https://example.org/social/post/1';
  assert.match(check(inflated).join(' '), /without external-share status/);
});

test('external share must have verifiable-shaped URL and date, not a GitHub file permalink', () => {
  const shared = copy();
  shared.months[0].status = 'EXTERNALLY_SHARED';
  assert.match(check(shared).join(' '), /requires an HTTPS share_url/);
  shared.months[0].share_url = 'https://github.com/example/public/blob/main/docs/CODEX_GUIDE.md';
  shared.months[0].shared_at = '2026-11-03';
  assert.match(check(shared).join(' '), /does not prove external community sharing/);
  shared.months[0].share_url = 'https://example.org/community/real-post';
  assert.deepEqual(check(shared), []);
});

test('feedback cannot be recorded without an external link to it', () => {
  const post = copy();
  post.months[0].status = 'FEEDBACK_RECORDED';
  post.months[0].share_url = 'https://example.org/community/real-post';
  post.months[0].shared_at = '2026-11-03';
  assert.match(check(post).join(' '), /requires cited feedback/);
  post.months[0].feedback_urls = ['https://example.org/community/reply/1'];
  assert.deepEqual(check(post), []);
});

test('malformed dates, invalid URLs and fake source PR are rejected', () => {
  const badDate = copy();
  badDate.months[0].published_at = '2026-11-31';
  assert.match(check(badDate).join(' '), /valid date/);
  const badSource = copy();
  badSource.months[0].source_pr = 'javascript:alert(1)';
  assert.match(check(badSource).join(' '), /GitHub PR URL/);
  const badFeedback = copy();
  badFeedback.months[0].feedback_urls = ['file:///etc/passwd'];
  assert.match(check(badFeedback).join(' '), /feedback URL must be HTTPS/);
});

test('unknown status and missing topic are rejected', () => {
  const broken = copy();
  broken.months[0].status = 'APPROVED_AMBASSADOR';
  broken.months[0].topic = '';
  const errors = check(broken).join(' ');
  assert.match(errors, /unsupported status/);
  assert.match(errors, /topic is missing/);
});
