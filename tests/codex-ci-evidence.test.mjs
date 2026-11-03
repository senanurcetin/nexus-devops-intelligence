import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCiEvidence } from '../scripts/verify-codex-ci-evidence.mjs';

const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const REQUIRED = 'Tests, types and production build';
const entry = (name = REQUIRED, { status = 'completed', conclusion = 'success', head_sha = SHA } = {}) =>
  ({ name, status, conclusion, head_sha });
const snapshot = (...checks) => ({ total_count: checks.length, check_runs: checks });
const evaluate = (payload, requiredChecks = [REQUIRED]) =>
  evaluateCiEvidence(payload, { expectedSha: SHA, requiredChecks });

test('exact SHA and named required success can pass, while optional skips stay visible', () => {
  const result = evaluate(snapshot(entry(), entry('Optional Linux matrix', { conclusion: 'skipped' })));
  assert.equal(result.gate, 'PASS');
  assert.equal(result.expected_sha, SHA);
  assert.equal(result.counts.passed, 1);
  assert.equal(result.counts.skipped, 1);
  assert.equal(result.independently_attested, false);
  assert.equal(result.merge_authorized, false);
});

test('a skipped required check cannot be called successful', () => {
  const r = evaluate(snapshot(entry(REQUIRED, { conclusion: 'skipped' })));
  assert.equal(r.gate, 'HOLD');
  assert.ok(r.reasons.includes('required_check_not_successful'));
});

test('an absent required check fails closed even if other checks succeeded', () => {
  const r = evaluate(snapshot(entry('Different check')));
  assert.equal(r.gate, 'HOLD');
  assert.ok(r.reasons.includes('required_check_missing'));
});

test('a failed optional job prevents a green overall result', () => {
  const r = evaluate(snapshot(entry(), entry('Security validation', { conclusion: 'failure' })));
  assert.equal(r.gate, 'FAIL');
  assert.equal(r.counts.failed, 1);
});

test('pending workflow stays on hold, not success', () => {
  const r = evaluate(snapshot(entry(REQUIRED, { status: 'in_progress', conclusion: null })));
  assert.equal(r.gate, 'HOLD');
  assert.equal(r.counts.pending, 1);
});

test('a check from a different commit invalidates source-pinned certification', () => {
  const r = evaluate(snapshot(entry(REQUIRED, { head_sha: OTHER })));
  assert.equal(r.gate, 'HOLD');
  assert.ok(r.reasons.includes('head_sha_mismatch'));
});

test('pagination-limited check-run data never certifies complete', () => {
  const p = snapshot(entry());
  p.total_count = 2;
  const r = evaluate(p);
  assert.equal(r.gate, 'HOLD');
  assert.ok(r.reasons.includes('check_run_count_mismatch'));
});

test('a repeated check name is ambiguous and cannot certify the required job', () => {
  const r = evaluate(snapshot(entry(), entry()));
  assert.equal(r.gate, 'HOLD');
  assert.ok(r.reasons.includes('duplicate_check_name'));
});

test('unexpected conclusion or malformed rows stay unverifiable', () => {
  const r = evaluate(snapshot(entry(REQUIRED, { conclusion: 'unknown_great' })));
  assert.equal(r.gate, 'HOLD');
  assert.ok(r.reasons.includes('invalid_check_run'));
  const malformed = evaluate({ total_count: 1, check_runs: [null] });
  assert.equal(malformed.gate, 'HOLD');
});

test('zero checks cannot pass by vacuous truth', () => {
  const r = evaluate(snapshot());
  assert.equal(r.gate, 'HOLD');
  assert.ok(r.reasons.includes('required_check_missing'));
});

test('source SHA and required check names must be explicit and safe', () => {
  assert.throws(() => evaluateCiEvidence(snapshot(entry()), { expectedSha: 'main', requiredChecks: [REQUIRED] }), /40-character/);
  assert.throws(() => evaluateCiEvidence(snapshot(entry()), { expectedSha: SHA, requiredChecks: [] }), /required/i);
  assert.throws(() => evaluateCiEvidence(snapshot(entry()), { expectedSha: SHA, requiredChecks: [REQUIRED, REQUIRED] }), /duplicate/i);
  assert.throws(() => evaluateCiEvidence(snapshot(entry()), { expectedSha: SHA, requiredChecks: ['\nunsafe'] }), /name/i);
});

test('distinct successful required checks can pass with no skips', () => {
  const r = evaluate(snapshot(entry(), entry('TypeScript type check')), [REQUIRED, 'TypeScript type check']);
  assert.equal(r.gate, 'PASS');
  assert.equal(r.counts.passed, 2);
  assert.deepEqual(r.reasons, []);
});

test('neutral results cannot replace successful required checks', () => {
  const r = evaluate(snapshot(entry(REQUIRED, { conclusion: 'neutral' })));
  assert.equal(r.gate, 'HOLD');
  assert.equal(r.counts.neutral, 1);
});

test('an invalid numeric total must never yield a certified snapshot', () => {
  const r = evaluate({ total_count: '1', check_runs: [entry()] });
  assert.equal(r.gate, 'HOLD');
  assert.ok(r.reasons.includes('invalid_total_count'));
});

test('duplicate optional names from independent workflows do not invalidate required evidence', () => {
  const r = evaluate(snapshot(
    entry(),
    entry('Cache preparation'),
    entry('Cache preparation', { conclusion: 'skipped' }),
  ));
  assert.equal(r.gate, 'PASS');
  assert.equal(r.counts.skipped, 1);
  assert.equal(r.counts.passed, 2);
});

test('offline CLI returns nonzero for an incomplete CI snapshot and no network is needed', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { spawnSync } = await import('node:child_process');
  const directory = mkdtempSync(join(tmpdir(), 'codex-ci-evidence-'));
  try {
    const file = join(directory, 'checks.json');
    const script = fileURLToPath(new URL('../scripts/verify-codex-ci-evidence.mjs', import.meta.url));
    const args = ['--sha', SHA, '--required', REQUIRED, '--file', file];
    writeFileSync(file, JSON.stringify(snapshot(entry())));
    const pass = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 10000 });
    assert.equal(pass.status, 0);
    assert.equal(JSON.parse(pass.stdout).gate, 'PASS');
    writeFileSync(file, JSON.stringify({ total_count: 2, check_runs: [entry()] }));
    const hold = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 10000 });
    assert.equal(hold.status, 2);
    assert.equal(JSON.parse(hold.stdout).gate, 'HOLD');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
