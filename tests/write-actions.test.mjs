import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  mintApprovalToken, payloadHash, canonicalJson, MemoryUsedTokenStore, FileUsedTokenStore, verifyApprovalToken,
} from '../src/lib/nexus-approval-token.ts';
import { planWriteAction, executeWriteAction, writeConfigFromEnv } from '../src/lib/nexus-write-actions.ts';

const SECRET = randomBytes(24).toString('hex'); // generated per run, never a literal
const OTHER_SECRET = randomBytes(24).toString('hex');
const GH_TOKEN = 'fake-' + randomBytes(8).toString('hex');
const NOW = new Date('2026-11-11T10:00:00Z');
const nowS = Math.floor(NOW.getTime() / 1000);
const env = {
  NEXUS_DEVOPS_WRITE_ACTIONS: '1', NEXUS_DEVOPS_WRITE_ALLOW: 'rerun_workflow,open_issue,label_pr',
  NEXUS_DEVOPS_WRITE_REPOS: 'owner/repo', NEXUS_DEVOPS_GITHUB_WRITE_TOKEN: GH_TOKEN, NEXUS_DEVOPS_APPROVAL_SECRET: SECRET,
};
const params = { repository: 'owner/repo', run_id: 42 };
function token(action = 'rerun_workflow', p = params, over = {}) {
  const planned = planWriteAction(action, p);
  return mintApprovalToken(SECRET, { v: 1, jti: 'grant0001abcdef', rid: 'req-1', act: action, ph: planned.payload_hash,
    iat: nowS - 5, exp: nowS + 300, ...over });
}
function fakeFetch(status = 200, body = { html_url: 'https://github.com/owner/repo/issues/9', number: 9 }) {
  const calls = [];
  const fetcher = async (url, init) => { calls.push({ url, init }); return { ok: status < 300, status, json: async () => body }; };
  return { fetcher, calls };
}
const base = (f, extra = {}) => ({ action: 'rerun_workflow', params, token: token(), config: writeConfigFromEnv(env),
  usedTokens: new MemoryUsedTokenStore(), fetcher: f.fetcher, now: NOW, ...extra });

test('canonical json matches jarvis canonical_json; payload hash is sha256 of it', () => {
  assert.equal(canonicalJson({ b: [1, 'é'], a: { d: true, c: null } }), '{"a":{"c":null,"d":true},"b":[1,"é"]}');
  // sha256('{"a":1}') — same value jarvis payload_hash({"a": 1}) produces
  assert.equal(payloadHash({ a: 1 }), '015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862');
  // cross-language vector computed with jarvis-next nexus_jarvis.approvals.store.payload_hash (2026-11-11)
  assert.equal(payloadHash({ action: 'open_issue', params: { repository: 'o/r', title: 'Çok é', body: 'x\ny', labels: ['bug'], n: 3 } }),
    'eaabe7b3065e5c95b6b8778805810e6cd923c4cf38e54a035c83e0fe260f30cb');
  assert.throws(() => canonicalJson({ x: 1.5 }));
});

test('default config (no env) is off: nothing is executed and no fetch happens', async () => {
  const f = fakeFetch();
  await assert.rejects(executeWriteAction(base(f, { config: writeConfigFromEnv({}) })), { reason: 'writes_disabled' });
  assert.equal(f.calls.length, 0);
});

test('refused without a token: missing, empty or non-string', async () => {
  for (const t of [undefined, '', 123, null]) {
    const f = fakeFetch();
    await assert.rejects(executeWriteAction(base(f, { token: t })), { reason: 'no_token' });
    assert.equal(f.calls.length, 0);
  }
});

test('valid token performs exactly one GitHub write with the bearer token and no secret leakage', async () => {
  const f = fakeFetch();
  const r = await executeWriteAction(base(f));
  assert.equal(r.ok, true);
  assert.equal(r.grant, 'grant0001abcdef');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, 'https://api.github.com/repos/owner/repo/actions/runs/42/rerun-failed-jobs');
  assert.equal(f.calls[0].init.method, 'POST');
  assert.equal(f.calls[0].init.headers.Authorization, `Bearer ${GH_TOKEN}`);
  assert.ok(!JSON.stringify(r).includes(GH_TOKEN));
});

test('token replay is refused (memory store) and does not write twice', async () => {
  const f = fakeFetch();
  const b = base(f);
  await executeWriteAction(b);
  await assert.rejects(executeWriteAction(b), { reason: 'replayed' });
  assert.equal(f.calls.length, 1);
});

test('token replay is refused across store instances (file store survives restarts)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nxa-'));
  try {
    const f = fakeFetch();
    const t = token();
    const mk = () => base(f, { token: t, usedTokens: new FileUsedTokenStore(dir) });
    await executeWriteAction(mk());
    await assert.rejects(executeWriteAction(mk()), { reason: 'replayed' });
    assert.equal(f.calls.length, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('token stays burned when GitHub fails after the burn (burn-first)', async () => {
  const store = new MemoryUsedTokenStore();
  const t = token();
  await assert.rejects(executeWriteAction(base(fakeFetch(500), { token: t, usedTokens: store })), { reason: 'github_error' });
  await assert.rejects(executeWriteAction(base(fakeFetch(), { token: t, usedTokens: store })), { reason: 'replayed' });
});

test('forged, tampered, wrong-secret, expired, wrong-action and changed-payload tokens are refused', async () => {
  const ph = planWriteAction('rerun_workflow', params).payload_hash;
  const cases = [
    ['bad_signature', token().replace(/.$/, c => (c === '0' ? '1' : '0'))],
    ['bad_signature', mintApprovalToken(OTHER_SECRET,
      { v: 1, jti: 'grant0001abcdef', rid: 'r', act: 'rerun_workflow', ph, iat: nowS, exp: nowS + 60 })],
    ['expired', token('rerun_workflow', params, { iat: nowS - 400, exp: nowS - 1 })],
    ['ttl_too_long', token('rerun_workflow', params, { exp: nowS + 5000 })],
    ['wrong_action', token('rerun_workflow', params, { act: 'open_issue' })],
    ['payload_mismatch', token('rerun_workflow', { repository: 'owner/repo', run_id: 43 })],
    ['malformed_token', 'nxa1.abc'],
  ];
  for (const [reason, t] of cases) {
    const f = fakeFetch();
    await assert.rejects(executeWriteAction(base(f, { token: t })), { reason }, reason);
    assert.equal(f.calls.length, 0);
  }
});

test('a missing or short approval secret refuses even a well-formed token', async () => {
  const f = fakeFetch();
  await assert.rejects(executeWriteAction(base(f, { config: writeConfigFromEnv({ ...env, NEXUS_DEVOPS_APPROVAL_SECRET: 'short' }) })),
    { reason: 'secret_missing' });
  assert.equal(f.calls.length, 0);
});

test('allow-lists: action and repository must both be enabled; GitHub token required before burning', async () => {
  const f = fakeFetch();
  const store = new MemoryUsedTokenStore();
  const t = token();
  const withEnv = e => base(f, { token: t, usedTokens: store, config: writeConfigFromEnv({ ...env, ...e }) });
  await assert.rejects(executeWriteAction(withEnv({ NEXUS_DEVOPS_WRITE_ALLOW: 'open_issue' })), { reason: 'action_not_enabled' });
  await assert.rejects(executeWriteAction(withEnv({ NEXUS_DEVOPS_WRITE_REPOS: 'other/repo' })), { reason: 'repository_not_allowed' });
  await assert.rejects(executeWriteAction(withEnv({ NEXUS_DEVOPS_GITHUB_WRITE_TOKEN: '' })), { reason: 'github_token_missing' });
  assert.equal(f.calls.length, 0);
  await executeWriteAction(withEnv({})); // the token was not burned by the refusals above
  assert.equal(f.calls.length, 1);
});

test('plan validates parameters strictly and is network free', () => {
  assert.throws(() => planWriteAction('merge_pr', params), { reason: 'unknown_action' });
  assert.throws(() => planWriteAction('rerun_workflow', { repository: 'owner/repo', run_id: '42' }), { reason: 'invalid_params' });
  assert.throws(() => planWriteAction('rerun_workflow', { repository: '../x', run_id: 1 }), { reason: 'invalid_params' });
  assert.throws(() => planWriteAction('rerun_workflow', { ...params, extra: 1 }), { reason: 'invalid_params' });
  assert.throws(() => planWriteAction('label_pr', { repository: 'o/r', pr_number: 1, labels: [] }), { reason: 'invalid_params' });
  assert.throws(() => planWriteAction('open_issue', { repository: 'o/r', title: '' }), { reason: 'invalid_params' });
  const p = planWriteAction('open_issue', { repository: 'o/r', title: 'T', labels: ['bug'] });
  assert.equal(p.request.url, 'https://api.github.com/repos/o/r/issues');
  assert.equal(p.payload_hash, payloadHash(p.payload));
});

test('open_issue and label_pr use their GitHub endpoints and bodies', async () => {
  for (const [action, p, url, body] of [
    ['open_issue', { repository: 'owner/repo', title: 'CI red', body: 'details', labels: ['ci'] },
      'https://api.github.com/repos/owner/repo/issues', { title: 'CI red', body: 'details', labels: ['ci'] }],
    ['label_pr', { repository: 'owner/repo', pr_number: 7, labels: ['needs-review'] },
      'https://api.github.com/repos/owner/repo/issues/7/labels', { labels: ['needs-review'] }],
  ]) {
    const f = fakeFetch();
    const r = await executeWriteAction(base(f, { action, params: p, token: token(action, p, { jti: 'grant-' + action }) }));
    assert.equal(r.ok, true);
    assert.equal(f.calls[0].url, url);
    assert.deepEqual(JSON.parse(f.calls[0].init.body), body);
  }
});

test('verifyApprovalToken is pure: does not burn', () => {
  const input = { token: token(), secret: SECRET, action: 'rerun_workflow', payload: planWriteAction('rerun_workflow', params).payload, now: NOW };
  assert.equal(verifyApprovalToken(input).jti, 'grant0001abcdef');
  assert.equal(verifyApprovalToken(input).jti, 'grant0001abcdef');
});
