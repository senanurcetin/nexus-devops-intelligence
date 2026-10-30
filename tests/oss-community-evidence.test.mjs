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
function mergedPr(login, number, {
  owner = 'demo', repo = 'tool', type = 'User', mergedAt = '2026-10-20T12:00:00Z',
} = {}) {
  return {
    number,
    html_url: `https://github.com/${owner}/${repo}/pull/${number}`,
    repository_url: `https://api.github.com/repos/${owner}/${repo}`,
    user: { login, type },
    pull_request: { merged_at: mergedAt },
  };
}

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
    mergedPr('demo', 1),
    mergedPr('Alice', 2),
    mergedPr('alice', 3),
    mergedPr('bob', 4),
    mergedPr('bot', 5, { type: 'Bot' }),
  ];
  const { fetchImpl, calls } = fixtureFetch({ items });
  const result = await collectCommunityEvidence('demo/tool', { fetchImpl, now });
  assert.equal(result.owner_account_at_least_two_years_old, true);
  assert.equal(result.github_license_spdx, 'MIT');
  assert.equal(result.merged_pr_search.complete, true);
  assert.equal(result.merged_pr_search.distinct_non_owner_human_authors_observed, 2);
  assert.deepEqual(result.merged_pr_search.non_owner_author_logins, ['alice', 'bob']);
  assert.equal(result.merged_pr_search.confirmed_distinct_non_owner_human_authors, 2);
  assert.match(calls[2].url, /merged%3A%3E%3D2025-10-30/);
  assert.ok(calls.every(call => call.options.method === 'GET' && call.url.startsWith('https://api.github.com/')));
  assert.ok(calls.every(call => !('Authorization' in call.options.headers)));
});

test('does not infer eligibility from a younger account or incomplete GitHub search', async () => {
  const { fetchImpl } = fixtureFetch({ ownerDate: '2026-01-01T00:00:00Z', items: [mergedPr('outside', 1)], total: 5 });
  const result = await collectCommunityEvidence('demo/tool', { fetchImpl, now });
  assert.equal(result.owner_account_at_least_two_years_old, false);
  assert.equal(result.merged_pr_search.complete, false);
  assert.equal(result.merged_pr_search.distinct_non_owner_human_authors_observed, 1);
  assert.equal(result.merged_pr_search.confirmed_distinct_non_owner_human_authors, null);
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
  const items = Array.from({ length: 100 }, (_, i) => mergedPr(`person${i}`, i + 1));
  const { fetchImpl, calls } = fixtureFetch({ items, total: 1100 });
  const result = await collectCommunityEvidence('demo/tool', { fetchImpl, now });
  assert.equal(result.merged_pr_search.complete, false);
  assert.equal(result.merged_pr_search.pages_read, 10);
  assert.equal(result.merged_pr_search.matches_examined, 1000);
  assert.equal(calls.length, 12);
});

test('unrelated, malformed and unmerged search hits cannot inflate verified authors', async () => {
  const attacks = [
    { repository_url: 'https://api.github.com/repos/unrelated/project' },
    { html_url: 'https://github.com/demo/other/pull/17' },
    { html_url: 'https://github.com/demo/tool/pull/17?extra=1' },
    { number: 999 },
    { pull_request: { merged_at: null } },
    { pull_request: { merged_at: 'not-a-date' } },
    { pull_request: { merged_at: '2026-02-30T12:00:00Z' } },
    { pull_request: { merged_at: '2026-10-30T10:00:01Z' } },
    { user: { login: 'stranger', type: 'Organization' } },
  ];
  for (const attack of attacks) {
    const forged = { ...mergedPr('stranger', 17), ...attack };
    const result = await collectCommunityEvidence('demo/tool', {
      fetchImpl: fixtureFetch({ items: [mergedPr('genuine', 7), forged] }).fetchImpl,
      now,
    });
    assert.equal(result.merged_pr_search.complete, false, JSON.stringify(attack));
    assert.equal(result.merged_pr_search.distinct_non_owner_human_authors_observed, 1);
    assert.equal(result.merged_pr_search.confirmed_distinct_non_owner_human_authors, null);
    assert.deepEqual(result.merged_pr_search.non_owner_author_logins, ['genuine']);
  }
});

test('same UTC search date earlier than exact one-year cutoff is excluded, not invalid', async () => {
  const result = await collectCommunityEvidence('demo/tool', {
    now,
    fetchImpl: fixtureFetch({
      items: [
        mergedPr('early', 1, { mergedAt: '2025-10-30T09:59:59Z' }),
        mergedPr('boundary', 2, { mergedAt: '2025-10-30T10:00:00Z' }),
      ],
    }).fetchImpl,
  });
  assert.equal(result.merged_pr_search.complete, true);
  assert.equal(result.merged_pr_search.excluded_before_exact_window, 1);
  assert.deepEqual(result.merged_pr_search.non_owner_author_logins, ['boundary']);
  assert.equal(result.merged_pr_search.confirmed_distinct_non_owner_human_authors, 1);
});

test('duplicate PR identifiers cannot be counted as a complete external contributor record', async () => {
  const item = mergedPr('first', 8);
  const duplicate = { ...mergedPr('second', 8), html_url: 'https://github.com/DEMO/tool/pull/8' };
  const result = await collectCommunityEvidence('demo/tool', {
    now, fetchImpl: fixtureFetch({ items: [item, duplicate] }).fetchImpl,
  });
  assert.equal(result.merged_pr_search.complete, false);
  assert.deepEqual(result.merged_pr_search.non_owner_author_logins, ['first']);
  assert.equal(result.merged_pr_search.confirmed_distinct_non_owner_human_authors, null);
});

test('impossible, ambiguous and future account dates never assert age eligibility', async () => {
  for (const ownerDate of ['1', '2026-02-30T00:00:00Z', 'not-a-date', '2027-01-01T00:00:00Z']) {
    const result = await collectCommunityEvidence('demo/tool', {
      fetchImpl: fixtureFetch({ ownerDate }).fetchImpl, now,
    });
    assert.equal(result.owner_account_created_at, null, ownerDate);
    assert.equal(result.owner_account_at_least_two_years_old, null, ownerDate);
  }
});
