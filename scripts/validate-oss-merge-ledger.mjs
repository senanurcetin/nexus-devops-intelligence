#!/usr/bin/env node
/** Offline consistency verification only. Does NOT query GitHub or certify Anthropic eligibility. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEFAULT_LEDGER_URL = new URL('../docs/OSS_MERGED_UPSTREAM_LEDGER_2026-10-30.json', import.meta.url);
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPO_RE = /^[A-Za-z0-9_.-]{1,100}$/;
const UTC_RE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;

function timestamp(raw, field) {
  assert.equal(typeof raw, 'string', `${field} must be a UTC timestamp`);
  assert.match(raw, UTC_RE, `${field} must be RFC3339 UTC with second precision`);
  const millis = Date.parse(raw);
  assert.ok(Number.isFinite(millis) && new Date(millis).toISOString() === raw.replace('Z', '.000Z'),
    `${field} must be a real canonical UTC timestamp`);
  return millis;
}

export function validateOssMergeLedger(ledger) {
  assert.ok(ledger && typeof ledger === 'object' && !Array.isArray(ledger), 'Expected ledger object');
  assert.equal(ledger.schema_version, 1, 'Unknown ledger schema');
  const owner = ledger.github_login;
  assert.ok(typeof owner === 'string' && OWNER_RE.test(owner), 'Invalid GitHub login');
  const snapshot = timestamp(ledger.snapshot_utc, 'snapshot_utc');
  const start = new Date(snapshot);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  assert.ok(Array.isArray(ledger.pull_requests) && ledger.pull_requests.length > 0 && ledger.pull_requests.length <= 1000,
    'Ledger must have 1..1000 entries');
  const ids = new Set();
  const owners = new Set();
  for (const [index, entry] of ledger.pull_requests.entries()) {
    const label = `pull_requests[${index}]`;
    assert.ok(entry && typeof entry === 'object' && !Array.isArray(entry), `${label}: invalid record`);
    assert.equal(entry.author?.toLowerCase(), owner.toLowerCase(), `${label}: author mismatch`);
    assert.equal(entry.merged, true, `${label}: unmerged PRs cannot count`);
    const parts = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/([1-9]\d*)$/.exec(entry.url);
    assert.ok(parts && OWNER_RE.test(parts[1]) && REPO_RE.test(parts[2]), `${label}: invalid canonical GitHub PR URL`);
    assert.ok(parts[1].toLowerCase() !== owner.toLowerCase(), `${label}: self-owned PR cannot count`);
    const id = `${parts[1]}/${parts[2]}#${parts[3]}`.toLowerCase();
    assert.ok(!ids.has(id), `${label}: duplicate PR`);
    ids.add(id);
    owners.add(parts[1].toLowerCase());
    const merged = timestamp(entry.merged_at, `${label}.merged_at`);
    assert.ok(merged >= start.getTime() && merged <= snapshot, `${label}: merge outside rolling-year snapshot`);
  }
  return {
    snapshot_utc: ledger.snapshot_utc,
    github_login: owner,
    verified_record_consistency_count: ids.size,
    distinct_upstream_owners: owners.size,
    coverage: 'OFFLINE_LEDGER_ONLY',
    qualification: 'NOT_ASSESSED',
    notice: 'Records were checked for internal consistency only. Recheck each PR live before application; GitHub merge data, contribution quality and Anthropic eligibility are NOT certified here.',
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    if (process.argv.length !== 2) throw new Error('Usage: node scripts/validate-oss-merge-ledger.mjs');
    const ledger = JSON.parse(readFileSync(DEFAULT_LEDGER_URL, 'utf8'));
    console.log(JSON.stringify(validateOssMergeLedger(ledger), null, 2));
  } catch (error) {
    console.error(`OSS ledger invalid: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  }
}
