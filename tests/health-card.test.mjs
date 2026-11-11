import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildHealthCard, quotaStatus, healthSourcesFromEnv } from '../src/lib/nexus-health-card.ts';

const NOW = new Date('2026-11-11T10:00:00Z');
const files = (map) => async (spec) => {
  if (!(spec in map)) throw new Error('missing');
  const v = map[spec];
  return typeof v === 'string' ? { text: v } : v;
};
const noRead = files({});

test('with nothing configured every check is unknown and overall is unknown (no network, no guessing)', async () => {
  const card = await buildHealthCard({ sources: {}, read: noRead, now: NOW });
  assert.equal(card.schema, 'nexus.devops.health-card/v1');
  assert.equal(card.overall, 'unknown');
  assert.equal(card.checks.length, 7);
  assert.ok(card.checks.every(c => c.status === 'unknown'));
  assert.equal(card.unknown_count, 7);
  assert.match(card.text, /UNKNOWN/);
});

test('configured but unreadable or malformed sources are unknown, not ok', async () => {
  const card = await buildHealthCard({
    sources: { oracleHeartbeat: 'a', kaggleQuota: 'b', providerQuota: 'c', neonUsage: 'd' },
    read: files({ b: 'not json', c: '{"providers":[]}', d: '{}' }), now: NOW,
  });
  const by = Object.fromEntries(card.checks.map(c => [c.id, c]));
  assert.equal(by.oracle_a1.status, 'unknown');
  assert.equal(by.oracle_a1.detail, 'source unreadable');
  assert.equal(by.kaggle_quota.status, 'unknown');
  assert.equal(by.provider_quota.status, 'unknown');
  assert.equal(by.neon_usage.status, 'unknown');
});

test('known sources produce ok/warn/critical and unknown ones do not mask them', async () => {
  const card = await buildHealthCard({
    sources: { oracleHeartbeat: 'hb', kaggleQuota: 'kg', providerQuota: 'pq', neonUsage: 'nn' },
    read: files({
      hb: JSON.stringify({ ts: '2026-11-11T09:55:00Z' }),
      kg: JSON.stringify({ gpu_hours_used: 28, gpu_hours_limit: 30 }),
      pq: JSON.stringify({ providers: [{ name: 'groq', used: 10, limit: 100 }, { name: 'mistral', used: 80, limit: 100 }] }),
      nn: JSON.stringify({ storage_gb_used: 0.1, compute_hours_used: 10 }),
    }), now: NOW,
  });
  const by = Object.fromEntries(card.checks.map(c => [c.id, c.status]));
  assert.equal(by.oracle_a1, 'ok');
  assert.equal(by.kaggle_quota, 'critical');
  assert.equal(by.provider_quota, 'warn');
  assert.equal(by.neon_usage, 'ok');
  assert.equal(by.actions, 'unknown');
  assert.equal(card.overall, 'critical');
});

test('oracle heartbeat: stale ISO line, file mtime fallback, and no timestamp', async () => {
  const stale = await buildHealthCard({ sources: { oracleHeartbeat: 'hb' }, read: files({ hb: '2026-11-11T07:00:00Z\n' }), now: NOW });
  assert.equal(stale.checks.find(c => c.id === 'oracle_a1').status, 'critical');
  const touched = await buildHealthCard({ sources: { oracleHeartbeat: 'hb' },
    read: files({ hb: { text: '', mtime: new Date('2026-11-11T09:50:00Z') } }), now: NOW });
  assert.equal(touched.checks.find(c => c.id === 'oracle_a1').status, 'ok');
  const none = await buildHealthCard({ sources: { oracleHeartbeat: 'hb' }, read: files({ hb: { text: 'garbage' } }), now: NOW });
  assert.equal(none.checks.find(c => c.id === 'oracle_a1').status, 'unknown');
});

test('quotaStatus thresholds and invalid input', () => {
  assert.equal(quotaStatus(74, 100).status, 'ok');
  assert.equal(quotaStatus(75, 100).status, 'warn');
  assert.equal(quotaStatus(90, 100).status, 'critical');
  for (const bad of [[1, 0], [-1, 5], ['1', 5], [NaN, 5], [undefined, 5]]) assert.equal(quotaStatus(...bad).status, 'unknown');
});

test('GitHub section from injected fetcher: actions, PRs and stale branches, no real network', async () => {
  const sha = 'a'.repeat(40), sha2 = 'b'.repeat(40);
  const urls = [];
  const created = '2026-11-11T09:00:00Z';
  const ok = (data) => ({ ok: true, status: 200, json: async () => data, headers: { get: () => null } });
  const fetcher = async (url) => {
    urls.push(url);
    if (url.includes('/actions/runs')) return ok({ total_count: 1, workflow_runs: [{ id: 1, name: 'CI', event: 'push', status: 'completed',
      conclusion: 'failure', created_at: created, html_url: 'https://github.com/o/r/actions/runs/1' }] });
    if (url.includes('/pulls?')) return ok([]);
    if (url.includes('/branches')) return ok([{ name: 'main', commit: { sha } }, { name: 'old', commit: { sha: sha2 } }, { name: 'fresh', commit: { sha } }]);
    if (url.includes(`/commits/${sha2}`)) return ok({ commit: { committer: { date: '2026-01-01T00:00:00Z' } } });
    if (url.includes(`/commits/${sha}`)) return ok({ commit: { committer: { date: '2026-11-10T00:00:00Z' } } });
    return { ok: false, status: 404, json: async () => ({}), headers: { get: () => null } };
  };
  const card = await buildHealthCard({ repository: 'o/r', sources: {}, read: noRead, fetcher, now: NOW });
  const by = Object.fromEntries(card.checks.map(c => [c.id, c]));
  assert.equal(by.actions.status, 'warn');
  assert.equal(by.open_prs.status, 'ok');
  assert.equal(by.stale_branches.status, 'warn');
  assert.match(by.stale_branches.detail, /^1 branches older than 30 days/);
  assert.ok(urls.every(u => u.startsWith('https://api.github.com/repos/o/r/')));
});

test('GitHub unavailable -> unknown, never ok', async () => {
  const fetcher = async () => { throw new Error('offline'); };
  const card = await buildHealthCard({ repository: 'o/r', sources: {}, read: noRead, fetcher, now: NOW });
  for (const id of ['actions', 'open_prs', 'stale_branches']) assert.equal(card.checks.find(c => c.id === id).status, 'unknown');
});

test('env mapping and module.json consistency with the code', () => {
  assert.deepEqual(healthSourcesFromEnv({ NEXUS_DEVOPS_HEALTH_KAGGLE_QUOTA: ' x.json ', NEXUS_DEVOPS_HEALTH_NEON_USAGE: '  ' }),
    { oracleHeartbeat: undefined, kaggleQuota: 'x.json', providerQuota: undefined, neonUsage: undefined });
  const mod = JSON.parse(readFileSync(new URL('../module.json', import.meta.url), 'utf8'));
  assert.equal(mod.access.write_actions_default, 'off');
  assert.deepEqual(mod.access.write_actions.map(a => a.name).sort(), ['label_pr', 'open_issue', 'rerun_workflow']);
  assert.ok(mod.access.write_actions.every(a => a.requires_approval_token === true));
  assert.equal(mod.access.merge_approval, false);
});
