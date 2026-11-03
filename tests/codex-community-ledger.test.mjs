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

test('external sharing cannot predate the cited published guide', () => {
  const shared = copy();
  shared.months[0].status = 'EXTERNALLY_SHARED';
  shared.months[0].share_url = 'https://example.org/community/post/1';
  shared.months[0].shared_at = '2026-11-01';
  assert.match(check(shared).join(' '), /cannot precede published_at/);
  shared.months[0].shared_at = '2026-11-03';
  assert.deepEqual(check(shared), []);
});

test('own-repository URLs and case variants are not external sharing evidence', () => {
  const shared = copy();
  shared.months[0].status = 'EXTERNALLY_SHARED';
  shared.months[0].shared_at = '2026-11-03';
  shared.months[0].share_url = 'https://GITHUB.com/SenanurCetin/NEXUS-DevOps-Intelligence/issues/144';
  assert.match(check(shared).join(' '), /does not prove external community sharing/);
  shared.months[0].share_url = 'https://RAW.GITHUBUSERCONTENT.COM/senanurcetin/nexus-devops-intelligence/main/docs/CODEX_GUIDE.md';
  assert.match(check(shared).join(' '), /does not prove external community sharing/);
  shared.months[0].share_url = 'https://github.com/another-owner/another-repo/discussions/123';
  assert.deepEqual(check(shared), []);
});

test('feedback must cite a distinct response, not the source PR or original shared post', () => {
  const feedback = copy();
  feedback.months[0].status = 'FEEDBACK_RECORDED';
  feedback.months[0].share_url = 'https://example.org/community/post/1';
  feedback.months[0].shared_at = '2026-11-03';
  feedback.months[0].feedback_urls = [feedback.months[0].share_url];
  assert.match(check(feedback).join(' '), /must differ from the shared post or source PR/);
  feedback.months[0].feedback_urls = [feedback.months[0].source_pr];
  assert.match(check(feedback).join(' '), /must differ from the shared post or source PR/);
  feedback.months[0].feedback_urls = ['https://example.org/community/reply/1'];
  assert.deepEqual(check(feedback), []);
});

test('a single externally shared post cannot count as two separate monthly contributions', () => {
  const data = copy();
  const nov = data.months[0];
  nov.status = 'EXTERNALLY_SHARED';
  nov.share_url = 'https://example.org/community/single-post';
  nov.shared_at = '2026-11-03';
  const dec = data.months[1];
  dec.status = 'EXTERNALLY_SHARED';
  dec.artifact = nov.artifact;
  dec.published_at = '2026-12-01';
  dec.source_pr = nov.source_pr;
  dec.share_url = nov.share_url;
  dec.shared_at = '2026-12-02';
  assert.match(check(data).join(' '), /share_url is reused across months/);
});

test('independent feedback cannot reuse the same response across monthly records', () => {
  const data = copy();
  const nov = data.months[0];
  nov.status = 'FEEDBACK_RECORDED';
  nov.share_url = 'https://example.org/community/nov-post';
  nov.shared_at = '2026-11-03';
  nov.feedback_urls = ['https://example.org/community/reply-123'];
  const dec = data.months[1];
  dec.status = 'FEEDBACK_RECORDED';
  dec.artifact = nov.artifact;
  dec.published_at = '2026-12-01';
  dec.source_pr = nov.source_pr;
  dec.share_url = 'https://example.org/community/dec-post';
  dec.shared_at = '2026-12-02';
  dec.feedback_urls = [nov.feedback_urls[0]];
  assert.match(check(data).join(' '), /feedback URL is reused across months/);
});

test('duplicated feedback links in one monthly record cannot inflate evidence', () => {
  const data = copy();
  const nov = data.months[0];
  nov.status = 'FEEDBACK_RECORDED';
  nov.share_url = 'https://example.org/community/nov-post';
  nov.shared_at = '2026-11-03';
  nov.feedback_urls = [
    'https://example.org/community/reply-123',
    'https://example.org:443/community/reply-123'
  ];
  assert.match(check(data).join(' '), /duplicate feedback URL/);
});

test('two monthly contributions with distinct external posts and feedback are allowed', () => {
  const data = copy();
  const nov = data.months[0];
  nov.status = 'FEEDBACK_RECORDED';
  nov.share_url = 'https://example.org/community/nov-post';
  nov.shared_at = '2026-11-03';
  nov.feedback_urls = ['https://example.org/community/nov-reply'];
  const dec = data.months[1];
  dec.status = 'FEEDBACK_RECORDED';
  dec.artifact = nov.artifact;
  dec.published_at = '2026-12-01';
  dec.source_pr = nov.source_pr;
  dec.share_url = 'https://example.org/community/dec-post';
  dec.shared_at = '2026-12-02';
  dec.feedback_urls = ['https://example.org/community/dec-reply'];
  assert.deepEqual(check(data), []);
});
