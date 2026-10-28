#!/usr/bin/env node
/**
 * Offline Vercel inventory reconciliation for an existing protected Preview.
 * A snapshot is SELF-SUPPLIED metadata, not an authenticated, live HTTP/SSO
 * assertion. This tool cannot make a deployment, pass G04/G06 or authorize a release.
 */
import { readFile, lstat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sha40 = /^[a-f0-9]{40}$/;
const projectIdPattern = /^prj_[a-zA-Z0-9]{12,80}$/;
const deploymentIdPattern = /^dpl_[a-zA-Z0-9]{12,80}$/;
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x) &&
  Object.getPrototypeOf(x) === Object.prototype;
const fail = reason => Object.assign(new Error(reason), {code:'INVALID_PREVIEW_METADATA'});
function validDate(t, now) {
  if (typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(t) ||
      !Number.isFinite(Date.parse(t)) || new Date(t).toISOString() !== t) return false;
  const elapsed = now.getTime() - Date.parse(t);
  return elapsed >= -5 * 60_000 && elapsed <= 24 * 60 * 60_000;
}
function validateDeployment(x, expectedProjectId) {
  if (!plain(x) || !deploymentIdPattern.test(x.id ?? '') ||
      !plain(x.project) || x.project.id !== expectedProjectId ||
      !plain(x.meta) || !sha40.test(x.meta.githubCommitSha ?? '') ||
      x.meta.githubOrg !== 'senanurcetin' ||
      x.meta.githubRepo !== 'nexus-devops-intelligence')
    throw fail('Inconsistent Vercel deployment identity or source metadata.');
}
/**
 * Compares declared identities only. Even an aligned READY/SOO-protected preview
 * still requires independent HTTP and SSO acceptance on the real deployment.
 */
export function assessPreviewInventory(snapshot, {
  expectedSha, expectedProjectId, now = new Date(), cleanCheckout = true,
} = {}) {
  if (!sha40.test(expectedSha ?? '') || !projectIdPattern.test(expectedProjectId ?? ''))
    throw fail('Expected source and Vercel project identities are required.');
  if (!plain(snapshot) || snapshot.schema_version !== 1 ||
      !validDate(snapshot.observed_at_utc, now) ||
      !plain(snapshot.project) || snapshot.project.id !== expectedProjectId ||
      snapshot.project.name !== 'nexus-devops-intelligence' ||
      !plain(snapshot.project.ssoProtection) || !plain(snapshot.preview))
    throw fail('Invalid or stale Vercel inventory snapshot.');
  validateDeployment(snapshot.preview, expectedProjectId);
  const p = snapshot.preview;
  if (p.target !== null && p.target !== 'preview') throw fail('Preview target is not verified.');
  const hasReady = p.state === 'READY';
  const sso = snapshot.project.ssoProtection.enabled === true &&
    snapshot.project.ssoProtection.deploymentType === 'all_except_custom_domains';
  const gitIdentity = p.meta.githubCommitRef === 'main';
  const matched = p.meta.githubCommitSha === expectedSha;
  const sourceClean = cleanCheckout === true;
  const reason = !sourceClean ? 'dirty_tracked_source' :
    !matched ? 'preview_source_sha_drift' :
    !hasReady ? 'preview_not_ready' :
    !sso ? 'sso_configuration_unverified' :
    !gitIdentity ? 'unexpected_git_branch' :
    'source_aligned_but_live_acceptance_required';
  return {
    evidence_gate: 'HOLD',
    release_authorized: false,
    expected_source_sha: expectedSha,
    observed_preview_sha: p.meta.githubCommitSha,
    preview_id: p.id,
    ready: hasReady,
    sso_configured: sso,
    exact_source_match: matched,
    live_sso_http_acceptance: 'NOT_VERIFIED',
    independent_redis_acceptance: 'NOT_VERIFIED',
    reason,
  };
}
export async function readPreviewInventory(path) {
  const name = resolve(path);
  const st = await lstat(name);
  if (!st.isFile() || st.isSymbolicLink() || st.size < 1 || st.size > 64 * 1024)
    throw fail('Inventory must be a bounded regular file.');
  const bytes = await readFile(name);
  let parsed;
  try { parsed = JSON.parse(bytes.toString('utf8')); }
  catch { throw fail('Inventory JSON malformed.'); }
  return parsed;
}
async function main() {
  const a = process.argv.slice(2);
  if (a.length !== 4 || a[0] !== '--snapshot' || a[2] !== '--project-id')
    throw fail('Explicit --snapshot PATH --project-id prj_ID required.');
  const shell = args => execFileSync('git', args, { encoding:'utf8', stdio:['ignore','pipe','ignore'] }).trim();
  const expectedSha = shell(['rev-parse','--verify','HEAD']).toLowerCase();
  const cleanCheckout = !shell(['status','--porcelain','--untracked-files=no']);
  const snapshot = await readPreviewInventory(a[1]);
  const result = assessPreviewInventory(snapshot, { expectedSha, expectedProjectId:a[3], cleanCheckout });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  // This inventory checker is intentionally never a CI deployment PASS.
  process.exitCode = 3;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(e => {
    process.stderr.write(JSON.stringify({evidence_gate:'HOLD',release_authorized:false,
      error:e?.code === 'INVALID_PREVIEW_METADATA' ? e.message : 'Unable to verify Preview inventory.'}) + '\n');
    process.exitCode = 3;
  });
