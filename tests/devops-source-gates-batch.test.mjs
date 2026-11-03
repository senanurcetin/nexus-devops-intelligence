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
  assert.match(shard, /min_ram=min_running/);
  assert.match(shard, /completed_log_hash_mismatch/);
  assert.match(shard, /runner\.lock/);
  assert.match(shard, /--test-concurrency=1/);
  assert.match(gate, /for mode in MODES/);
  assert.match(gate, /"release_authorized": False/);
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
      filename.includes('node_shards') ? /Ran 12 tests/ : /Ran 7 tests/);
  }
});
