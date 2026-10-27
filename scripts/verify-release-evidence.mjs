#!/usr/bin/env node
/**
 * Offline, read-only release evidence admission. Validated artifact hashes are
 * self-supplied assertions, NOT independent proof that tests were executed.
 * This program never authorizes production, triggers CI or accesses the network.
 */
import { createHash } from 'node:crypto';
import { readFile, lstat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const SOURCE_CHECKS = Object.freeze([
  'node_tests', 'typecheck', 'production_build', 'npm_audit',
  'local_http_smoke', 'js_bundle_budget',
  'chromium_fixture', 'firefox_fixture', 'webkit_fixture',
]);
export const SELF_HOSTED_CHECKS = Object.freeze([
  'windows_docker_runtime', 'native_ubuntu_docker_runtime',
  'os_image_cve_scan', 'container_security',
]);
export const PRODUCTION_CHECKS = Object.freeze([
  'exact_sha_protected_preview', 'human_accessibility',
  'independent_redis_instances', 'owner_release_approval', 'rollback_rehearsal',
]);
export const PHASE_CHECKS = Object.freeze({
  source: SOURCE_CHECKS,
  self_hosted: [...SOURCE_CHECKS, ...SELF_HOSTED_CHECKS],
  production: [...SOURCE_CHECKS, ...SELF_HOSTED_CHECKS, ...PRODUCTION_CHECKS],
});
const known = new Set([...SOURCE_CHECKS, ...SELF_HOSTED_CHECKS, ...PRODUCTION_CHECKS]);
const sha40 = /^[a-f0-9]{40}$/;
const sha64 = /^[a-f0-9]{64}$/;
const plain = x => x !== null && typeof x === 'object' &&
  !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
const fail = msg => Object.assign(new Error(msg), { code: 'INVALID_EVIDENCE' });

function recentUtc(x, now) {
  if (typeof x !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x) ||
      !Number.isFinite(Date.parse(x)) || new Date(x).toISOString() !== x) return false;
  const delta = now.getTime() - Date.parse(x);
  return delta >= -300000 && delta <= 30 * 86400000;
}
function safeName(x) {
  return typeof x === 'string' &&
    /^receipts\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}\.json$/.test(x) &&
    !x.includes('..') && x.length <= 100;
}
async function verifyCheck(id, rec, manifest, dir, now) {
  if (!plain(rec) || !['PASS','FAIL','NOT_RUN'].includes(rec.status))
    return { id, status: 'INVALID', reason: 'invalid_status' };
  if (rec.status === 'NOT_RUN')
    return ('receipt_path' in rec || 'receipt_sha256' in rec)
      ? { id, status: 'INVALID', reason: 'not_run_has_receipt' }
      : { id, status: 'NOT_RUN' };
  if (rec.status === 'FAIL') return { id, status: 'FAIL' };
  if (!safeName(rec.receipt_path) || !sha64.test(rec.receipt_sha256 ?? ''))
    return { id, status: 'INVALID', reason: 'unsafe_receipt_reference' };
  try {
    const folder = await lstat(join(dir, 'receipts'));
    if (!folder.isDirectory() || folder.isSymbolicLink())
      return { id, status: 'INVALID', reason: 'unsafe_receipt_folder' };
    const f = await lstat(resolve(dir, rec.receipt_path));
    if (!f.isFile() || f.isSymbolicLink() || f.size <= 0 || f.size > 2 * 1024 * 1024)
      return { id, status: 'INVALID', reason: 'unsafe_receipt_file' };
    const bytes = await readFile(resolve(dir, rec.receipt_path));
    if (createHash('sha256').update(bytes).digest('hex') !== rec.receipt_sha256)
      return { id, status: 'INVALID', reason: 'hash_mismatch' };
    const receipt = JSON.parse(bytes.toString('utf8'));
    if (!plain(receipt) || receipt.schema_version !== 1 ||
        receipt.check_id !== id || receipt.source_sha !== manifest.source_sha ||
        receipt.result !== 'PASS' || !recentUtc(receipt.observed_at_utc, now))
      return { id, status: 'INVALID', reason: 'wrong_source_check_result_or_time' };
    return { id, status: 'PASS' };
  } catch {
    return { id, status: 'INVALID', reason: 'unreadable_receipt' };
  }
}
/** Never emits content, credentials, arbitrary artifact paths or release approval. */
export async function evaluateReleaseEvidence(manifest, {
  expectedSha, manifestDir, mode = 'source', now = new Date(), cleanCheckout = true,
}) {
  if (!Object.hasOwn(PHASE_CHECKS, mode)) throw fail('Unknown release phase.');
  if (!sha40.test(expectedSha ?? '')) throw fail('Cannot verify local Git HEAD.');
  if (!plain(manifest) || manifest.schema_version !== 1 ||
      !sha40.test(manifest.source_sha ?? '') || !plain(manifest.checks))
    throw fail('Invalid evidence manifest.');
  if (Object.keys(manifest.checks).some(id => !known.has(id)))
    throw fail('Unknown evidence check.');
  if (manifest.source_sha !== expectedSha || !cleanCheckout)
    return { schema_version: 1, mode, source_sha: expectedSha, evidence_gate: 'HOLD',
      release_authorized: false, checks: [], reason: cleanCheckout ? 'source_sha_mismatch' : 'dirty_tracked_source' };
  const checks = [];
  for (const id of PHASE_CHECKS[mode]) {
    checks.push(Object.hasOwn(manifest.checks, id)
      ? await verifyCheck(id, manifest.checks[id], manifest, manifestDir, now)
      : { id, status: 'NOT_RUN' });
  }
  const gate = checks.some(x => ['FAIL','INVALID'].includes(x.status)) ? 'FAIL' :
    checks.some(x => x.status !== 'PASS') ? 'HOLD' : 'EVIDENCE_COMPLETE';
  return { schema_version: 1, mode, source_sha: expectedSha, evidence_gate: gate,
    release_authorized: false, reason: gate === 'EVIDENCE_COMPLETE'
      ? 'self_supplied_receipts_not_independent_attestation'
      : 'missing_failed_or_untrusted_evidence', checks };
}
export async function readManifest(file) {
  const path = resolve(file);
  const s = await lstat(path);
  if (!s.isFile() || s.isSymbolicLink() || s.size <= 0 || s.size > 96 * 1024)
    throw fail('Manifest is not an allowed regular file.');
  return { data: JSON.parse(await readFile(path, 'utf8')), dir: dirname(path) };
}
async function main() {
  const a = process.argv.slice(2);
  if (a.length !== 4 || a[0] !== '--mode' || a[2] !== '--manifest')
    throw fail('Explicit --mode source|self_hosted|production --manifest PATH required.');
  const { data, dir } = await readManifest(a[3]);
  const git = (args) => execFileSync('git', args, {
    encoding: 'utf8', stdio: ['ignore','pipe','ignore'],
  }).trim();
  const result = await evaluateReleaseEvidence(data, { expectedSha: git(['rev-parse','--verify','HEAD']).toLowerCase(),
    manifestDir: dir, mode: a[1], cleanCheckout: !git(['status','--porcelain','--untracked-files=no']) });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  // Production approval is never implied by self-supplied evidence receipts.
  process.exitCode = a[1] === 'production' || result.evidence_gate !== 'EVIDENCE_COMPLETE' ? 3 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(e => {
    process.stderr.write(JSON.stringify({ evidence_gate: 'HOLD', release_authorized: false,
      error: e?.code === 'INVALID_EVIDENCE' ? e.message : 'Evidence cannot be safely evaluated.' }) + '\n');
    process.exitCode = 3;
  });
