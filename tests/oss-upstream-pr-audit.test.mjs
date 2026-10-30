import test from 'node:test';
import assert from 'node:assert/strict';
import { auditUpstreamPRs, validateLogin } from '../scripts/oss-upstream-pr-audit.mjs';

const now = new Date('2026-10-30T10:00:00.000Z');
function pr(owner, number, author = 'tester') {
  return {
    html_url: `https://github.com/${owner}/widget/pull/${number}`,
    repository_url: `https://api.github.com/repos/${owner}/widget`,
    title: `Fix ${number}`,
    user: { login: author },
    pull_request: { merged_at: '2026-10-20T12:00:00Z' },
  };
}
function fixture(mergedItems = [], openItems = [], { mergedIncomplete = false, reportedTotal = null, status = null } = {}) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    const isMerged = new URL(url).searchParams.get('q').includes('is:merged');
    if (status && isMerged) return { ok: false, status };
    const items = isMerged ? mergedItems : openItems;
    return { ok: true, json: async () => ({ total_count: isMerged && reportedTotal !== null ? reportedTotal : items.length, incomplete_results: isMerged && mergedIncomplete, items }) };
  };
  return { fetchImpl, calls };
}

test('rejects malformed logins before using the network', async () => {
  for (const login of ['bad/name', '-starts', 'trailing-', 'a'.repeat(40), 'a b', 'a?b', '']) {
    assert.throws(() => validateLogin(login));
  }
  let calls = 0;
  await assert.rejects(auditUpstreamPRs('bad/name', { now, fetchImpl: () => { calls++; } }));
  assert.equal(calls, 0);
});

test('counts only valid third-party merged PRs and keeps open PRs distinct', async () => {
  const { fetchImpl, calls } = fixture([pr('upstream', 2), pr('outside', 10)], [pr('upstream', 99)]);
  const result = await auditUpstreamPRs('tester', { now, fetchImpl });
  assert.equal(result.merged_in_other_owners_repositories.confirmed_count, 2);
  assert.equal(result.open_in_other_owners_repositories.confirmed_count, 1);
  assert.equal(result.merged_since_utc_date, '2025-10-30');
  assert.ok(calls[0].url.includes('merged%3A%3E%3D2025-10-30'));
  assert.ok(calls.every(x => x.url.startsWith('https://api.github.com/search/issues?') && x.opts.method === 'GET'));
  assert.ok(calls.every(x => !('Authorization' in x.opts.headers)));
});

test('excludes self-owned PRs instead of counting them toward upstream', async () => {
  const { fetchImpl } = fixture([pr('tester', 13)]);
  const result = await auditUpstreamPRs('tester', { now, fetchImpl });
  assert.equal(result.merged_in_other_owners_repositories.confirmed_count, null);
  assert.equal(result.merged_in_other_owners_repositories.complete, false);
  assert.equal(result.merged_in_other_owners_repositories.observed_valid_external_prs, 0);
});

test('does not certify partial GitHub search or unverifiable PR links', async () => {
  const { fetchImpl } = fixture([pr('upstream', 5)], [], { mergedIncomplete: true });
  const result = await auditUpstreamPRs('tester', { now, fetchImpl });
  assert.equal(result.merged_in_other_owners_repositories.confirmed_count, null);
  assert.equal(result.merged_in_other_owners_repositories.observed_valid_external_prs, 1);
});

test('mismatched hit totals remain incomplete without false counts', async () => {
  const { fetchImpl } = fixture([pr('upstream', 5)], [], { reportedTotal: 2 });
  const result = await auditUpstreamPRs('tester', { now, fetchImpl });
  assert.equal(result.merged_in_other_owners_repositories.complete, false);
});

test('rate-limited responses fail the audit instead of returning zero', async () => {
  await assert.rejects(auditUpstreamPRs('tester', { now, fetchImpl: fixture([], [], { status: 403 }).fetchImpl }), /HTTP 403/);
});

test('exact UTC boundary excludes earlier same-day merges without making complete results unknown', async () => {
  const before = pr('upstream', 1);
  before.pull_request.merged_at = '2025-10-30T09:59:59.999Z';
  const onBoundary = pr('upstream', 2);
  onBoundary.pull_request.merged_at = '2025-10-30T10:00:00.000Z';
  const { fetchImpl } = fixture([before, onBoundary]);
  const result = await auditUpstreamPRs('tester', { now, fetchImpl });
  assert.equal(result.merged_since_utc_timestamp, '2025-10-30T10:00:00.000Z');
  assert.equal(result.merged_in_other_owners_repositories.complete, true);
  assert.equal(result.merged_in_other_owners_repositories.confirmed_count, 1);
  assert.equal(result.merged_in_other_owners_repositories.excluded_before_exact_window, 1);
  assert.deepEqual(result.merged_in_other_owners_repositories.prs.map(x => x.number), [2]);
  assert.equal(result.merged_in_other_owners_repositories.prs[0].merged_at, onBoundary.pull_request.merged_at);
});

test('unknown, malformed or future merged timestamps never count as verified', async () => {
  for (const mergedAt of [undefined, 'not-a-date', '2026-10-30T10:00:00.001Z']) {
    const item = pr('upstream', 4);
    item.pull_request.merged_at = mergedAt;
    const result = await auditUpstreamPRs('tester', {
      now, fetchImpl: fixture([item]).fetchImpl,
    });
    assert.equal(result.merged_in_other_owners_repositories.observed_valid_external_prs, 0);
    assert.equal(result.merged_in_other_owners_repositories.confirmed_count, null);
    assert.equal(result.merged_in_other_owners_repositories.complete, false);
  }
});


test('early search hits from an earlier calendar day do not masquerade as expected boundary exclusions', async () => {
  const earlierDay = pr('upstream', 1);
  earlierDay.pull_request.merged_at = '2025-10-29T23:59:59Z';
  const onBoundary = pr('upstream', 2);
  onBoundary.pull_request.merged_at = '2025-10-30T10:00:00Z';
  const result = await auditUpstreamPRs('tester', { now, fetchImpl: fixture([earlierDay, onBoundary]).fetchImpl });
  assert.equal(result.merged_in_other_owners_repositories.confirmed_count, null);
  assert.equal(result.merged_in_other_owners_repositories.complete, false);
  assert.equal(result.merged_in_other_owners_repositories.excluded_before_exact_window, 0);
});

test('non-UTC, overflowed and non-canonical timestamps are unverifiable', async () => {
  for (const bad of ['2026-02-30T12:00:00Z', '2026-10-20', '2026-10-20T12:00:00+00:00', '2026-10-20T12:00:00.00Z']) {
    const hit = pr('upstream', 1);
    hit.pull_request.merged_at = bad;
    const result = await auditUpstreamPRs('tester', { now, fetchImpl: fixture([hit]).fetchImpl });
    assert.equal(result.merged_in_other_owners_repositories.confirmed_count, null);
    assert.equal(result.merged_in_other_owners_repositories.observed_valid_external_prs, 0);
  }
});

test('same-day exclusion remains safe when there are no eligible merges', async () => {
  const before = pr('upstream', 1);
  before.pull_request.merged_at = '2025-10-30T00:00:00Z';
  const result = await auditUpstreamPRs('tester', { now, fetchImpl: fixture([before]).fetchImpl });
  assert.equal(result.merged_in_other_owners_repositories.confirmed_count, 0);
  assert.equal(result.merged_in_other_owners_repositories.excluded_before_exact_window, 1);
  assert.equal(result.merged_in_other_owners_repositories.complete, true);
});

test('duplicate search hits cannot be certified even beside a valid cutoff exclusion', async () => {
  const before = pr('upstream', 1);
  before.pull_request.merged_at = '2025-10-30T00:00:00Z';
  const hit = pr('upstream', 2);
  const result = await auditUpstreamPRs('tester', { now, fetchImpl: fixture([before, hit, hit]).fetchImpl });
  assert.equal(result.merged_in_other_owners_repositories.confirmed_count, null);
  assert.equal(result.merged_in_other_owners_repositories.complete, false);
});

test('duplicate PR identifiers with mixed-case owner URLs fail closed', async () => {
  const item = pr('upstream', 2);
  const otherCase = pr('UPSTREAM', 2);
  const result = await auditUpstreamPRs('tester', { now, fetchImpl: fixture([item, otherCase]).fetchImpl });
  assert.equal(result.merged_in_other_owners_repositories.confirmed_count, null);
  assert.equal(result.merged_in_other_owners_repositories.complete, false);
});

test('duplicate same-day cutoff exclusions cannot masquerade as complete results', async () => {
  const before = pr('upstream', 1);
  before.pull_request.merged_at = '2025-10-30T00:00:00Z';
  const result = await auditUpstreamPRs('tester', { now, fetchImpl: fixture([before, before]).fetchImpl });
  assert.equal(result.merged_in_other_owners_repositories.confirmed_count, null);
  assert.equal(result.merged_in_other_owners_repositories.complete, false);
  assert.equal(result.merged_in_other_owners_repositories.excluded_before_exact_window, 1);
});
