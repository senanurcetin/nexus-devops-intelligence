#!/usr/bin/env node
/**
 * Offline GitHub check-run snapshot inspection.
 * Self-supplied JSON is NOT authenticated GitHub evidence, merge approval,
 * release authorization, or proof of a complete CI run.
 */
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const COMPLETE = new Set(['success', 'failure', 'cancelled', 'timed_out',
  'action_required', 'startup_failure', 'stale', 'skipped', 'neutral']);
const BAD = new Set(['failure', 'cancelled', 'timed_out', 'action_required',
  'startup_failure', 'stale']);
const VALID_STATES = new Set(['queued', 'in_progress', 'pending', 'completed']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validName = value => typeof value === 'string' && value.length <= 120 &&
  /^[^\x00-\x1f\x7f]+$/.test(value) && value.trim() === value;

function validateArgs(expectedSha, requiredChecks) {
  if (typeof expectedSha !== 'string' || !SHA.test(expectedSha)) {
    throw new Error('An exact lowercase 40-character commit SHA is required');
  }
  if (!Array.isArray(requiredChecks) || requiredChecks.length === 0 || requiredChecks.length > 40) {
    throw new Error('At least one required check name is required (maximum 40)');
  }
  if (!requiredChecks.every(validName)) throw new Error('Invalid required check name');
  if (new Set(requiredChecks).size !== requiredChecks.length) {
    throw new Error('A duplicate required check name is not allowed');
  }
}

/**
 * Inspect only a single, complete, exact-SHA check-runs collection.
 * "PASS" means the provided payload is internally consistent, not verified
 * against GitHub. Required check names are compared case-sensitively.
 */
export function evaluateCiEvidence(payload, { expectedSha, requiredChecks } = {}) {
  validateArgs(expectedSha, requiredChecks);
  const reasons = new Set();
  const counts = { passed: 0, failed: 0, pending: 0, skipped: 0, neutral: 0, unknown: 0 };
  const knownNames = new Map();
  const rows = isRecord(payload) && Array.isArray(payload.check_runs) ? payload.check_runs : [];
  if (!isRecord(payload) || !Array.isArray(payload.check_runs)) reasons.add('invalid_check_runs');
  if (!Number.isSafeInteger(payload?.total_count) || payload.total_count < 0) {
    reasons.add('invalid_total_count');
  } else {
    if (payload.total_count !== rows.length) reasons.add('check_run_count_mismatch');
    if (payload.total_count > 100) reasons.add('single_page_limit_exceeded');
  }

  for (const row of rows) {
    if (!isRecord(row) || !validName(row.name) ||
        !VALID_STATES.has(row.status) ||
        typeof row.head_sha !== 'string' || !SHA.test(row.head_sha)) {
      reasons.add('invalid_check_run');
      counts.unknown++;
      continue;
    }
    if (row.head_sha !== expectedSha) reasons.add('head_sha_mismatch');
    // GitHub can repeat optional job names across distinct workflow suites.
    // Only an ambiguous required-name match invalidates certification.
    if (requiredChecks.includes(row.name) && knownNames.has(row.name)) reasons.add('duplicate_check_name');
    knownNames.set(row.name, row);
    if (row.status !== 'completed') {
      if (row.conclusion !== null && row.conclusion !== undefined) {
        reasons.add('invalid_check_run');
        counts.unknown++;
      } else {
        counts.pending++;
      }
      continue;
    }
    if (!COMPLETE.has(row.conclusion)) {
      reasons.add('invalid_check_run');
      counts.unknown++;
    } else if (row.conclusion === 'success') counts.passed++;
    else if (BAD.has(row.conclusion)) counts.failed++;
    else if (row.conclusion === 'skipped') counts.skipped++;
    else counts.neutral++;
  }

  for (const required of requiredChecks) {
    if (!knownNames.has(required)) reasons.add('required_check_missing');
    else {
      const row = knownNames.get(required);
      if (row.status !== 'completed' || row.conclusion !== 'success') {
        reasons.add('required_check_not_successful');
      }
    }
  }

  const gate = reasons.size ? 'HOLD' : counts.failed ? 'FAIL' : counts.pending ? 'HOLD' : 'PASS';
  return {
    gate,
    expected_sha: expectedSha,
    required_checks: [...requiredChecks],
    observed_checks: rows.length,
    counts,
    reasons: [...reasons].sort(),
    independently_attested: false,
    merge_authorized: false,
  };
}

function cli(argv) {
  const requiredChecks = [];
  let sha;
  let file;
  if (argv.length === 0 || argv.length % 2 !== 0) throw new Error('Usage: --sha SHA --required "CHECK NAME" --file JSON');
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--sha' && sha === undefined) sha = value;
    else if (flag === '--required') requiredChecks.push(value);
    else if (flag === '--file' && file === undefined) file = value;
    else throw new Error('Unsupported or repeated CLI argument');
  }
  validateArgs(sha, requiredChecks);
  if (typeof file !== 'string' || !file || file.startsWith('-')) throw new Error('A JSON file path is required');
  const path = resolve(file);
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > 256 * 1024) {
    throw new Error('Refusing unsafe or oversized JSON evidence file');
  }
  const payload = JSON.parse(readFileSync(path, 'utf8'));
  const result = evaluateCiEvidence(payload, { expectedSha: sha, requiredChecks });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.gate !== 'PASS') process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    cli(process.argv.slice(2));
  } catch {
    process.stderr.write('HOLD: invalid offline CI evidence or arguments; no merge/release authorization.\n');
    process.exitCode = 2;
  }
}
