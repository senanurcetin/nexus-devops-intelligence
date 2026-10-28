import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { evaluateReleaseEvidence, readManifest, SOURCE_CHECKS, PHASE_CHECKS } from '../scripts/verify-release-evidence.mjs';

const sha = 'a'.repeat(40);
const now = new Date('2026-10-27T18:00:00.000Z');
const manifest = () => ({ schema_version: 1, source_sha: sha, checks: {} });
const options = dir => ({ expectedSha: sha, manifestDir: dir, now, cleanCheckout: true });

async function sandbox(callback) {
  const dir = await mkdtemp(join(tmpdir(), 'nexus-release-'));
  await mkdir(join(dir, 'receipts'));
  try { await callback(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}
async function addPass(m, dir, id, data = {}) {
  const path = 'receipts/' + id + '.json';
  const bytes = Buffer.from(JSON.stringify({ schema_version: 1, source_sha: sha,
    check_id: id, result: 'PASS', observed_at_utc: now.toISOString(), ...data }));
  await writeFile(join(dir, path), bytes);
  m.checks[id] = { status: 'PASS', receipt_path: path,
    receipt_sha256: createHash('sha256').update(bytes).digest('hex') };
}

test('Absent evidence is HOLD and never authorizes releases', async () => {
  await sandbox(async dir => {
    const result = await evaluateReleaseEvidence(manifest(), options(dir));
    assert.equal(result.evidence_gate, 'HOLD');
    assert.equal(result.release_authorized, false);
    assert.equal(result.checks.length, SOURCE_CHECKS.length);
    assert.ok(result.checks.every(x => x.status === 'NOT_RUN'));
  });
});

test('Full source receipts cannot promote missing Ubuntu or production gates', async () => {
  await sandbox(async dir => {
    const m = manifest();
    for (const id of SOURCE_CHECKS) await addPass(m, dir, id);
    const source = await evaluateReleaseEvidence(m, options(dir));
    assert.equal(source.evidence_gate, 'EVIDENCE_COMPLETE');
    assert.equal(source.release_authorized, false);
    const docker = await evaluateReleaseEvidence(m, { ...options(dir), mode: 'self_hosted' });
    assert.equal(docker.evidence_gate, 'HOLD');
    assert.ok(docker.checks.some(x => x.id === 'native_ubuntu_docker_runtime' && x.status === 'NOT_RUN'));
    const prod = await evaluateReleaseEvidence(m, { ...options(dir), mode: 'production' });
    assert.equal(prod.evidence_gate, 'HOLD');
    assert.equal(prod.release_authorized, false);
    assert.equal(prod.checks.length, PHASE_CHECKS.production.length);
  });
});

test('Source drift or a modified checkout immediately HOLD', async () => {
  await sandbox(async dir => {
    const m = manifest();
    await addPass(m, dir, 'node_tests');
    assert.equal((await evaluateReleaseEvidence(m, { ...options(dir),
      expectedSha: 'b'.repeat(40) })).reason, 'source_sha_mismatch');
    assert.equal((await evaluateReleaseEvidence(m, { ...options(dir),
      cleanCheckout: false })).reason, 'dirty_tracked_source');
  });
});

test('Tampering, stale receipt, fake source and missing hash fail closed', async () => {
  await sandbox(async dir => {
    const m = manifest();
    await addPass(m, dir, 'node_tests');
    await writeFile(join(dir, 'receipts/node_tests.json'), '{}');
    assert.equal((await evaluateReleaseEvidence(m, options(dir))).checks[0].reason, 'hash_mismatch');
    await addPass(m, dir, 'node_tests', { source_sha: 'b'.repeat(40) });
    assert.equal((await evaluateReleaseEvidence(m, options(dir))).checks[0].status, 'INVALID');
    await addPass(m, dir, 'node_tests', { observed_at_utc: '2025-01-01T00:00:00.000Z' });
    assert.equal((await evaluateReleaseEvidence(m, options(dir))).checks[0].status, 'INVALID');
    m.checks.node_tests = { status: 'PASS' };
    assert.equal((await evaluateReleaseEvidence(m, options(dir))).checks[0].status, 'INVALID');
  });
});

test('Receipt path traversal and symlink are forbidden', async () => {
  await sandbox(async dir => {
    const m = manifest();
    m.checks.node_tests = { status: 'PASS', receipt_path: '../secret.json',
      receipt_sha256: '0'.repeat(64) };
    assert.equal((await evaluateReleaseEvidence(m, options(dir))).checks[0].reason, 'unsafe_receipt_reference');
    await symlink(join(dir, 'receipts/missing.json'), join(dir, 'receipts/link.json'));
    m.checks.node_tests = { status: 'PASS', receipt_path: 'receipts/link.json',
      receipt_sha256: '0'.repeat(64) };
    assert.equal((await evaluateReleaseEvidence(m, options(dir))).checks[0].reason, 'unsafe_receipt_file');
  });
});

test('FAIL vetoes; NOT_RUN cannot masquerade as proof; unexpected fields rejected', async () => {
  await sandbox(async dir => {
    const m = manifest();
    m.checks.node_tests = { status: 'FAIL' };
    assert.equal((await evaluateReleaseEvidence(m, options(dir))).evidence_gate, 'FAIL');
    m.checks.node_tests = { status: 'NOT_RUN', receipt_path: 'receipts/a.json' };
    assert.equal((await evaluateReleaseEvidence(m, options(dir))).checks[0].status, 'INVALID');
    m.checks.forged_gate = { status: 'PASS' };
    await assert.rejects(evaluateReleaseEvidence(m, options(dir)), /Unknown evidence check/);
  });
});

test('Manifest must be a bounded regular file without symlink', async () => {
  await sandbox(async dir => {
    const p = join(dir, 'manifest.json');
    await writeFile(p, JSON.stringify(manifest()));
    assert.equal((await readManifest(p)).data.source_sha, sha);
    const link = join(dir, 'linked.json');
    await symlink(p, link);
    await assert.rejects(readManifest(link), /allowed regular file/);
    await writeFile(p, 'x'.repeat(100_000));
    await assert.rejects(readManifest(p), /allowed regular file/);
  });
});
