import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateOssMergeLedger } from '../scripts/validate-oss-merge-ledger.mjs';

const source = new URL('../docs/OSS_MERGED_UPSTREAM_LEDGER_2026-10-30.json', import.meta.url);
const loaded = () => JSON.parse(readFileSync(source, 'utf8'));

function mutated(edit) {
  const ledger = loaded();
  edit(ledger);
  return ledger;
}

test('real dated 15-row ledger passes offline structural validation only', () => {
  const report = validateOssMergeLedger(loaded());
  assert.equal(report.verified_record_consistency_count, 15);
  assert.equal(report.distinct_upstream_owners, 6);
  assert.equal(report.coverage, 'OFFLINE_LEDGER_ONLY');
  assert.equal(report.qualification, 'NOT_ASSESSED');
});

test('rejects unmerged and self-owned PRs', () => {
  assert.throws(() => validateOssMergeLedger(mutated(x => { x.pull_requests[0].merged = false; })), /unmerged/);
  assert.throws(() => validateOssMergeLedger(mutated(x => { x.pull_requests[0].url = 'https://github.com/senanurcetin/tool/pull/1'; })), /self-owned/);
});

test('rejects duplicate PRs regardless of URL case', () => {
  assert.throws(() => validateOssMergeLedger(mutated(x => {
    x.pull_requests.push({ ...x.pull_requests[0], url: x.pull_requests[0].url.replace('/pyjanitor-devs/pyjanitor/', '/PYJANITOR-DEVS/PYJANITOR/') });
  })), /duplicate PR/);
});

test('rejects non-canonical, off-domain and credential-carrying URLs', () => {
  for (const url of ['https://evil.example/a/b/pull/1', 'https://github.com/u/r/pull/1?token=secret',
    'https://actor:secret@github.com/u/r/pull/1', 'http://github.com/u/r/pull/1', 'https://github.com/u/r/issues/1']) {
    assert.throws(() => validateOssMergeLedger(mutated(x => { x.pull_requests[0].url = url; })), /invalid canonical/);
  }
});

test('rejects bad timestamps including leap overflow and future merges', () => {
  for (const merged_at of ['2026-02-30T00:00:00Z', '2026-10-30T23:59:59Z', '2025-10-29T23:59:59Z', 'not-a-date', '2026-10-20']) {
    assert.throws(() => validateOssMergeLedger(mutated(x => { x.pull_requests[0].merged_at = merged_at; })));
  }
});

test('rejects mismatched author and bogus schema', () => {
  assert.throws(() => validateOssMergeLedger(mutated(x => { x.pull_requests[0].author = 'other'; })), /author mismatch/);
  assert.throws(() => validateOssMergeLedger(mutated(x => { x.schema_version = 999; })), /schema/);
});

test('rejects malformed snapshot and empty ledger', () => {
  assert.throws(() => validateOssMergeLedger(mutated(x => { x.snapshot_utc = '2026-10-30T00:00:00+03:00'; })));
  assert.throws(() => validateOssMergeLedger(mutated(x => { x.pull_requests = []; })), /1\.\.1000/);
});
