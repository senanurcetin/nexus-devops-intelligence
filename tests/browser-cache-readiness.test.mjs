import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts', 'inspect-browser-cache-offline.py');

function python() {
  for (const candidate of [process.env.NEXUS_ACCEPTANCE_PYTHON, 'python3', 'python'].filter(Boolean)) {
    const p = spawnSync(candidate, ['--version'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    if (p.status === 0 && /Python 3\.(1[1-9]|[2-9]\d)/.test(p.stdout + p.stderr)) return candidate;
  }
  return null;
}

test('browser preflight makes no executable test or production release claims', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /"chromium_fixture": "NOT_RUN"/);
  assert.match(source, /"firefox_fixture": "NOT_RUN"/);
  assert.match(source, /"webkit_fixture": "NOT_RUN"/);
  assert.match(source, /"human_accessibility": "NOT_RUN"/);
  assert.match(source, /"release_authorized": False/);
  assert.match(source, /"browser_processes_launched": False/);
  assert.doesNotMatch(source, /subprocess\.Popen|npm install|playwright\.install|git push|Start-ScheduledTask/);
});

test('synthetic browser asset checks reject missing engines, wrong revisions and release claims', t => {
  const exe = python();
  if (!exe) return t.skip('Python 3.11+ unavailable');
  const cmd = spawnSync(exe, ['-B', 'tests/test_inspect_browser_cache.py'],
    { cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(cmd.status, 0, cmd.stdout + '\n' + cmd.stderr);
  assert.match(cmd.stdout + cmd.stderr, /Ran 13 tests/);
});

test('batch runbook uses current Git SHA instead of a stale accepted test inventory', () => {
  const guide = readFileSync(path.join(root, 'docs', 'DEVOPS_BATCH_SOURCE_GATES.md'), 'utf8');
  assert.match(guide, /\$sha = \(& git -C \$accepted rev-parse HEAD\)\.Trim\(\)/);
  assert.doesNotMatch(guide, /accepted 76-file test inventory|\$sha = "4d748e6/);
  assert.match(guide, /historical 4d748e6/);
});
