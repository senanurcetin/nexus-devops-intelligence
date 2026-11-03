import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPullRequest, summarizePublicPullRequests } from '../src/lib/nexus-public-prs.ts';

const repo = 'owner/project';
function pr(number, overrides = {}) {
  return {
    number, title: 'Fix test ' + number, draft: false,
    html_url: `https://github.com/${repo}/pull/${number}`,
    updated_at: '2026-10-12T12:00:00Z', user: { login: 'contributor' },
    ...overrides,
  };
}
function detail(number, overrides = {}) {
  return {
    number, html_url: `https://github.com/${repo}/pull/${number}`,
    mergeable: true, mergeable_state: 'clean', ...overrides,
  };
}

test('categorizes confirmed merge conflicts and separate protection blockers', () => {
  const result = summarizePublicPullRequests(repo,
    [pr(1), pr(2), pr(3), pr(4), pr(5), pr(6)],
    [detail(1, { mergeable: false, mergeable_state: 'dirty' }),
      detail(2, { mergeable_state: 'blocked' }),
      detail(3, { mergeable_state: 'behind' }),
      detail(4, { mergeable_state: 'unstable' }),
      detail(5)],
  );
  assert.equal(result.more_open_prs, true);
  assert.equal(result.inspected_prs, 5);
  assert.equal(result.conflicts, 1);
  assert.equal(result.needs_attention, 4);
  assert.deepEqual(result.pull_requests.map(p => p.attention),
    ['conflict', 'blocked', 'behind', 'unstable', 'clear']);
  assert.match(result.scope_note, /not an exhaustive audit/);
});

test('draft state wins; missing, mismatched and pending details remain unknown', () => {
  const result = summarizePublicPullRequests(repo, [pr(3, { draft: true }), pr(4), pr(5), pr(6)],
    [null, null, detail(3, { mergeable: false }), detail(6, { mergeable: null, mergeable_state: 'unknown' })]);
  assert.deepEqual(result.pull_requests.map(p => p.attention), ['draft', 'unknown', 'unknown', 'unknown']);
  assert.equal(result.unknown, 3);
  assert.equal(result.conflicts, 0);
});

test('unverified PRs contribute to needs_attention but drafts and clean PRs do not', () => {
  const result = summarizePublicPullRequests(repo,
    [pr(1), pr(2, { draft: true }), pr(3), pr(4), pr(5)],
    [null, null, detail(3), detail(4, { mergeable_state: 'blocked' }),
      detail(5, { mergeable: null, mergeable_state: 'unknown' })],
  );
  assert.deepEqual(result.pull_requests.map(item => item.attention),
    ['unknown', 'draft', 'clear', 'blocked', 'unknown']);
  assert.equal(result.inspected_prs, 5);
  assert.equal(result.unknown, 2);
  assert.equal(result.conflicts, 0);
  assert.equal(result.needs_attention, 3,
    'unverified and confirmed restricted PRs both require human inspection');
});

test('an entirely unverified PR sample is counted without inventing conflicts', () => {
  const result = summarizePublicPullRequests(repo,
    [pr(7), pr(8), pr(9)], [null, null, null]);
  assert.equal(result.needs_attention, 3);
  assert.equal(result.unknown, 3);
  assert.equal(result.conflicts, 0);
  assert.ok(result.pull_requests.every(item => item.attention === 'unknown'));
});

test('rejects unsafe repo names, forged PR links, corrupt list shapes and mismatched slots', () => {
  const good = [pr(1)];
  for (const name of ['http://evil.test/x', '../project', 'owner/project?x=1']) {
    assert.throws(() => summarizePublicPullRequests(name, good, [null]));
  }
  for (const bad of [null, {}, 'not a list', Array.from({ length: 7 }, (_, i) => pr(i+1))]) {
    assert.throws(() => summarizePublicPullRequests(repo, bad, []));
  }
  assert.throws(() => summarizePublicPullRequests(repo, good, []));
  assert.throws(() => summarizePublicPullRequests(repo,
    [pr(1, { html_url: 'https://evil.example/phishing' })], [null]));
  assert.throws(() => summarizePublicPullRequests(repo,
    [pr(1, { number: 1.5 })], [null]));
});

test('handles zero PRs and does not invent merge status when not computed', () => {
  const empty = summarizePublicPullRequests(repo, [], []);
  assert.equal(empty.inspected_prs, 0);
  assert.equal(empty.more_open_prs, false);
  assert.deepEqual(classifyPullRequest(false, { mergeable: null, mergeable_state: 'unknown' }).attention, 'unknown');
  assert.equal(classifyPullRequest(false, null).attention, 'unknown');
});

test('rejects repeated PR numbers in the same sample', () => {
  assert.throws(() => summarizePublicPullRequests(repo, [pr(4), pr(4)], [null, null]),
    /Duplicate GitHub pull request number/);
});

test('PR list and detail head commits must match before any merge assessment', () => {
  const first = 'a'.repeat(40);
  const next = 'b'.repeat(40);
  const base = 'c'.repeat(40);
  const listed = pr(42, { head: { sha: first }, base: { sha: base } });
  const consistent = detail(42, { head: { sha: first }, base: { sha: base } });
  const aligned = summarizePublicPullRequests(repo, [listed], [consistent]);
  assert.deepEqual(aligned.pull_requests.map(item => item.attention), ['clear']);

  for (const stale of [
    detail(42, { head: { sha: next }, base: { sha: base } }),
    detail(42, { head: { sha: first }, base: { sha: next } }),
    detail(42, { head: { sha: first } }),
    detail(42, { base: { sha: base } }),
    detail(42, { head: { sha: 'not-a-sha' }, base: { sha: base } }),
  ]) {
    const result = summarizePublicPullRequests(repo, [listed], [stale]);
    assert.equal(result.pull_requests[0].attention, 'unknown');
    assert.equal(result.unknown, 1);
    assert.equal(result.needs_attention, 1);
    assert.equal(result.conflicts, 0);
  }
});

test('stale PR details cannot claim a conflict or approval blocker for a newer revision', () => {
  const current = pr(77, { head: { sha: 'a'.repeat(40) }, base: { sha: 'c'.repeat(40) } });
  for (const mergeable_state of ['dirty', 'blocked', 'clean']) {
    const mismatched = detail(77, {
      mergeable_state,
      mergeable: mergeable_state !== 'dirty',
      head: { sha: 'b'.repeat(40) },
      base: { sha: 'c'.repeat(40) },
    });
    const result = summarizePublicPullRequests(repo, [current], [mismatched]);
    assert.equal(result.pull_requests[0].attention, 'unknown', mergeable_state);
    assert.equal(result.needs_attention, 1);
  }
});

test('invalid optional base revision in a PR listing fails before trusting merge details', () => {
  assert.throws(() => summarizePublicPullRequests(repo, [
    pr(80, { base: { sha: 'not-a-git-id' } }),
  ], [detail(80)]), /Invalid GitHub pull request/);
});
