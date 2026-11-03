import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts', 'verify-local-build-acceptance.py');
const suite = path.join(root, 'tests', 'test_verify_local_build_acceptance.py');

function python() {
  const candidates = [process.env.NEXUS_ACCEPTANCE_PYTHON, 'python3', 'python'].filter(Boolean);
  for (const executable of candidates) {
    const probe = spawnSync(executable, ['--version'],
      { encoding: 'utf8', timeout: 5000, windowsHide: true });
    if (probe.status === 0 && /Python 3\.(1[1-9]|[2-9]\d)/.test(probe.stdout + probe.stderr)) {
      return executable;
    }
  }
  return null;
}

test('local acceptance must remain opt-in, isolated and non-deploying', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /parser\.add_argument\("--execute", action="store_true"/);
  assert.match(source, /if not args\.execute:\s*\n\s*print\(json\.dumps\(readiness/);
  assert.match(source, /MIN_START_MB = 4096/);
  assert.match(source, /MIN_RUNNING_MB = 1800/);
  assert.match(source, /checked_git\(repo, "worktree", "add", "--detach"/);
  assert.match(source, /"worktree", "remove", "--force", str\(worktree\)/);
  assert.match(source, /"NEXUS_BASE_URL": base, "NEXUS_DEVOPS_BASE_URL": base/);
  assert.doesNotMatch(source, /\bgit\s+push\b|npm ci|npm install|Stop-Service|Start-ScheduledTask/);
});

test('Python safety regressions validate resource guards without running a server', t => {
  const exe = python();
  if (!exe) return t.skip('Python 3.11+ is not available');
  const run = spawnSync(exe, ['-B', suite],
    { cwd: root, encoding: 'utf8', timeout: 30_000, windowsHide: true });
  assert.equal(run.status, 0, run.stdout + '\n' + run.stderr);
  assert.match(run.stdout + run.stderr, /Ran 12 tests/);
});

test('default Python CLI only reports preflight status', t => {
  const exe = python();
  if (!exe) return t.skip('Python 3.11+ is not available');
  const run = spawnSync(exe, ['-B', script],
    { cwd: root, encoding: 'utf8', timeout: 30_000, windowsHide: true });
  assert.ok([0, 2].includes(run.status), 'unexpected status ' + run.status + ': ' + run.stderr);
  const result = JSON.parse(run.stdout.trim());
  assert.ok(['ready', 'blocked'].includes(result.state));
  assert.ok(Array.isArray(result.issues));
  assert.ok(!('spawned_pid' in result));
});
