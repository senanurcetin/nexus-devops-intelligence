import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const auditor = path.join(root, 'scripts', 'audit-local-acceptance.py');
const pythonSuite = path.join(root, 'tests', 'test_audit_local_acceptance.py');

function python() {
  const candidates = [process.env.NEXUS_ACCEPTANCE_PYTHON, 'python3', 'python'].filter(Boolean);
  for (const exe of candidates) {
    const result = spawnSync(exe, ['--version'],
      { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    if (result.status === 0 && /Python 3\.(1[1-9]|[2-9]\d)/.test(result.stdout + result.stderr)) return exe;
  }
  return null;
}

test('auditor cannot turn self-reported local acceptance into deployment authority', () => {
  const text = readFileSync(auditor, 'utf8');
  assert.match(text, /"release_authorized": False/);
  assert.match(text, /"trust": "self_reported_local_artifacts_not_independently_attested"/);
  assert.match(text, /"LOCAL_ACCEPTED" if result\["current_sha_matches"\] else "HOLD"/);
  assert.match(text, /"historical_sha_or_dirty_checkout"/);
  assert.match(text, /load_local_file\(path, MAX_LOG/);
  assert.doesNotMatch(text, /subprocess\.Popen|Start-ScheduledTask|\.write_text\(|git push|npm install|fetch\(/);
});

test('local acceptance auditor rejects missing, forged or stale evidence offline', t => {
  const executable = python();
  if (!executable) return t.skip('Python 3.11+ unavailable');
  const run = spawnSync(executable, ['-B', pythonSuite],
    { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(run.status, 0, run.stdout + '\n' + run.stderr);
  assert.match(run.stdout + run.stderr, /Ran 15 tests/);
});
