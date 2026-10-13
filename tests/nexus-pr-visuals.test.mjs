import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePublicPullRequests } from '../src/lib/nexus-public-prs.ts';
import {
  pullBucket, pullBucketCount, filteredPublicPulls, pullBuckets,
} from '../src/lib/nexus-pr-visuals.ts';

const repo = 'owner/example';
const pr = (n, draft = false) => ({
  number: n, title: 'PR ' + n, draft,
  html_url: 'https://github.com/' + repo + '/pull/' + n,
  updated_at: '2026-10-13T12:00:00Z', user: { login: 'contributor' },
});
const detail = (n, state, mergeable = null) => ({
  number: n, html_url: 'https://github.com/' + repo + '/pull/' + n,
  mergeable_state: state, mergeable,
});
const five = () => summarizePublicPullRequests(repo,
  [pr(81), pr(82), pr(83), pr(84), pr(85, true), pr(86)],
  [detail(81, 'dirty', false), detail(82, 'blocked'), null,
    detail(84, 'clean', true), null],
);

test('source-backed open PR sample maps to five disjoint status groups', () => {
  const summary = five();
  assert.equal(summary.inspected_prs, 5);
  assert.equal(summary.more_open_prs, true);
  assert.equal(summary.needs_attention, 3);
  assert.equal(summary.conflicts, 1);
  assert.equal(summary.unknown, 1);
  const expected = { conflict: 1, restrictions: 1, unverified: 1, clean: 1, draft: 1 };
  for (const { key } of pullBuckets) {
    assert.equal(pullBucketCount(summary, key), expected[key]);
    assert.equal(filteredPublicPulls(summary, key).length, expected[key]);
  }
  assert.equal(pullBuckets.reduce((count, x) => count + pullBucketCount(summary, x.key), 0),
    summary.inspected_prs);
});

test('blocked, behind and unstable are restrictions; never reported as conflicts or failed CI', () => {
  for (const state of ['blocked', 'behind', 'unstable']) {
    const summary = summarizePublicPullRequests(repo, [pr(80)], [detail(80, state)]);
    assert.equal(summary.needs_attention, 1);
    assert.equal(summary.conflicts, 0);
    assert.equal(pullBucket(summary.pull_requests[0]), 'restrictions');
  }
});

test('drafts remain distinct from missing merge details and clean does not imply approval', () => {
  const draft = summarizePublicPullRequests(repo, [pr(77, true)], [null]);
  const unknown = summarizePublicPullRequests(repo, [pr(77)], [null]);
  const clean = summarizePublicPullRequests(repo, [pr(77)], [detail(77, 'clean', true)]);
  assert.equal(pullBucket(draft.pull_requests[0]), 'draft');
  assert.equal(pullBucket(unknown.pull_requests[0]), 'unverified');
  assert.equal(pullBucket(clean.pull_requests[0]), 'clean');
  assert.equal(clean.needs_attention, 0);
});

test('filters preserve canonical GitHub order and do not mutate original data', () => {
  const sample = five();
  const snapshot = JSON.stringify(sample);
  assert.deepEqual(filteredPublicPulls(sample, 'all').map(p => p.number), [81, 82, 83, 84, 85]);
  assert.deepEqual(filteredPublicPulls(sample, 'conflict').map(p => p.number), [81]);
  assert.deepEqual(filteredPublicPulls(sample, 'restrictions').map(p => p.number), [82]);
  assert.deepEqual(filteredPublicPulls(sample, 'unverified').map(p => p.number), [83]);
  assert.deepEqual(filteredPublicPulls(sample, 'clean').map(p => p.number), [84]);
  assert.deepEqual(filteredPublicPulls(sample, 'draft').map(p => p.number), [85]);
  assert.equal(JSON.stringify(sample), snapshot);
});

test('unloaded and empty PR responses produce no speculative data or distribution', () => {
  assert.deepEqual(filteredPublicPulls(null, 'all'), []);
  assert.deepEqual(filteredPublicPulls(null, 'conflict'), []);
  const empty = summarizePublicPullRequests(repo, [], []);
  assert.equal(empty.inspected_prs, 0);
  assert.deepEqual(filteredPublicPulls(empty, 'all'), []);
  for (const { key } of pullBuckets) assert.equal(pullBucketCount(empty, key), 0);
});

test('source categories do not hide the explicit five-item sample ceiling', () => {
  const summary = five();
  const all = filteredPublicPulls(summary, 'all');
  assert.equal(all.length, 5);
  assert.equal(summary.more_open_prs, true);
  assert.equal(all.some(p => p.number === 86), false);
});
