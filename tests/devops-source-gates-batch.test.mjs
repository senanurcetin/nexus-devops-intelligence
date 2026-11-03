import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'scripts/run-node-shards.py',
  'scripts/inspect-source-readiness.py',
  'scripts/inspect-lockfile-offline.py',
];

function python() {
  for (const name of [process.env.NEXUS_ACCEPTANCE_PYTHON, 'python3', 'python'].filter(Boolean)) {
    const probe = spawnSync(name, ['--version'],
      { encoding: 'utf8', timeout: 5000, windowsHide: true });
    if (probe.status === 0 && /Python 3\.(1[1-9]|[2-9]\d)/.test(probe.stdout + probe.stderr)) return name;
  }
  return null;
}

test('batch tools cannot turn source test evidence into release authorization', () => {
  const shard = readFileSync(path.join(root, files[0]), 'utf8');
  const gate = readFileSync(path.join(root, files[1]), 'utf8');
  for (const content of [shard, gate]) {
    assert.match(content, /"release_authorized": False/);
    assert.doesNotMatch(content, /git push|npm install|npm ci|Start-ScheduledTask|Stop-Service|subprocess\.Popen\(\["npm"/);
  }
  assert.match(shard, /parser\.add_argument\("--execute", action="store_true"\)/);
  assert.match(shard, /if is_elevated\(\)/);
  assert.match(shard, /if free < min_start/);
  assert.match(shard, /stable_shard_ram_mb\(guard, min_start\)/);
  assert.match(shard, /time\.sleep\(1\)/);
  assert.match(shard, /min_ram=min_running/);
  assert.match(shard, /completed_log_hash_mismatch/);
  assert.match(shard, /runner\.lock/);
  assert.match(shard, /--test-concurrency=1/);
  assert.match(shard, /parser\.add_argument\("--only-file"/);
  assert.match(shard, /invalid_test_selection/);
  assert.match(gate, /for mode in MODES/);
  assert.match(gate, /"release_authorized": False/);
});

test('offline npm lockfile metadata audit cannot claim CVE or release approval', t => {
  const source = readFileSync(path.join(root, files[2]), 'utf8');
  assert.match(source, /"npm_audit_status": "NOT_RUN"/);
  assert.match(source, /"cve_assessment_performed": False/);
  assert.match(source, /"actual_tarball_bytes_verified": False/);
  assert.match(source, /"release_authorized": False/);
  assert.match(source, /duplicate_json_key/);
  assert.match(source, /registry\.npmjs\.org/);
  assert.doesNotMatch(source, /npm audit --online|npm install|git push|Start-ScheduledTask/);
  const exe = python();
  if (!exe) return t.skip('Python 3.11+ unavailable');
  const suite = spawnSync(exe, ['-B', 'tests/test_inspect_lockfile_offline.py'],
    { cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(suite.status, 0, suite.stdout + '\n' + suite.stderr);
  assert.match(suite.stderr + suite.stdout, /Ran 10 tests/);
});

test('offline safety regressions cover resume, evidence tampering and 3 release phases', t => {
  const exe = python();
  if (!exe) return t.skip('Python 3.11+ not installed');
  for (const filename of [
    'tests/test_run_node_shards.py',
    'tests/test_inspect_source_readiness.py',
  ]) {
    const result = spawnSync(exe, ['-B', filename],
      { cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true });
    assert.equal(result.status, 0, filename + '\n' + result.stdout + '\n' + result.stderr);
    assert.match(result.stderr + result.stdout,
      filename.includes('node_shards') ? /Ran 18 tests/ : /Ran 7 tests/);
  }
});
