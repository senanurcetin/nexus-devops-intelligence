import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCommunityEvidence, parseRepository } from '../scripts/oss-community-evidence.mjs';

function fixtureFetch({ ownerDate = '2020-01-01T00:00:00Z', items = [], total = items.length, incomplete = false, errorStatus = 0 } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (errorStatus && url.includes('/search/issues')) return { ok: false, status: errorStatus };
    const body = url.includes('/repos/')
      ? { full_name: 'demo/tool', private: false, license: { spdx_id: 'MIT' }, created_at: '2024-01-01T00:00:00Z' }
      : url.includes('/users/')
        ? { type: 'User', created_at: ownerDate }
        : { total_count: total, incomplete_results: incomplete, items };
    return { ok: true, json: async () => body };
  };
  return { fetchImpl, calls };
}
const now = new Date('2026-10-30T10:00:00Z');

test('rejects unsafe repositories before any GitHub request', async () => {
  for (const input of ['demo', 'https://github.com/demo/tool', 'demo/tool/extra', 'demo/../tool', 'demo/tool?token=x', 'a/'.repeat(100)]) {
    assert.throws(() => parseRepository(input));
  }
  let calls = 0;
  await assert.rejects(collectCommunityEvidence('evil/repo/extra', { fetchImpl: () => { calls++; }, now }));
  assert.equal(calls, 0);
});

test('reports verified account age and non-owner author proxy with exact coverage', async () => {
  const items = [
    { user: { login: 'demo', type: 'User' } },
    { user: { login: 'Alice', type: 'User' } },
    { user: { login: 'alice', type: 'User' } },
    { user: { login: 'bob', type: 'User' } },
    { user: { login: 'bot', type: 'Bot' } },
  ];
  const { fetchImpl, calls } = fixtureFetch({ items });
  const result = await collectCommunityEvidence('demo/tool', { fetchImpl, now });
  assert.equal(result.owner_account_at_least_two_years_old, true);
  assert.equal(result.github_license_spdx, 'MIT');
  assert.equal(result.merged_pr_search.complete, true);
  assert.equal(result.merged_pr_search.distinct_non_owner_human_authors_observed, 2);
  assert.deepEqual(result.merged_pr_search.non_owner_author_logins, ['alice', 'bob']);
  assert.match(calls[2].url, /merged%3A%3E%3D2025-10-30/);
  assert.ok(calls.every(call => call.options.method === 'GET' && call.url.startsWith('https://api.github.com/')));
  assert.ok(calls.every(call => !('Authorization' in call.options.headers)));
});

test('does not infer eligibility from a younger account or incomplete GitHub search', async () => {
  const { fetchImpl } = fixtureFetch({ ownerDate: '2026-01-01T00:00:00Z', items: [{ user: { login: 'outside', type: 'User' } }], total: 5 });
  const result = await collectCommunityEvidence('demo/tool', { fetchImpl, now });
  assert.equal(result.owner_account_at_least_two_years_old, false);
  assert.equal(result.merged_pr_search.complete, false);
  assert.equal(result.merged_pr_search.distinct_non_owner_human_authors_observed, 1);
  assert.ok(result.unverified.includes('Formal Claude for OSS qualification'));
});

test('search incomplete_results remains incomplete even when all returned matches were read', async () => {
  const result = await collectCommunityEvidence('demo/tool', { fetchImpl: fixtureFetch({ incomplete: true }).fetchImpl, now });
  assert.equal(result.merged_pr_search.complete, false);
});

test('API failure never becomes a misleading successful snapshot', async () => {
  const { fetchImpl } = fixtureFetch({ errorStatus: 403 });
  await assert.rejects(collectCommunityEvidence('demo/tool', { fetchImpl, now }), /HTTP 403/);
});

test('caps search at ten pages and marks anything above 1,000 incomplete', async () => {
  const items = Array.from({ length: 100 }, (_, i) => ({ user: { login: `person${i}`, type: 'User' } }));
  const { fetchImpl, calls } = fixtureFetch({ items, total: 1100 });
  const result = await collectCommunityEvidence('demo/tool', { fetchImpl, now });
  assert.equal(result.merged_pr_search.complete, false);
  assert.equal(result.merged_pr_search.pages_read, 10);
  assert.equal(result.merged_pr_search.matches_examined, 1000);
  assert.equal(calls.length, 12);
});
