import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const start = readFileSync(path.join(root, 'ops/windows/Start-NexusDevops.ps1'), 'utf8');
const status = readFileSync(path.join(root, 'ops/windows/Test-NexusDevops.ps1'), 'utf8');

function powershell() {
  for (const exe of ['powershell.exe', 'pwsh']) {
    const p = spawnSync(exe, ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.Major'],
      { encoding: 'utf8', timeout: 15000, windowsHide: true });
    if (p.status === 0) return exe;
  }
  return null;
}

test('restart guards run before each Next.js child spawn and do not turn on disabled tasks', () => {
  assert.match(start, /\$restartBuild = Get-NexusDevopsBuildStatus -RepoRoot \$RepoRoot/);
  assert.match(start, /if \(\$restartBuild\.State -ne 'current'\)/);
  assert.match(start, /if \(\$restartFreeRamMb -lt 2048\)/);
  const guardAt = start.indexOf('$restartBuild =');
  const spawnAt = start.indexOf("start -H 127.0.0.1 -p $Port");
  const loopAt = start.indexOf('while ($true)');
  assert.ok(loopAt >= 0 && loopAt < guardAt && guardAt < spawnAt);
  assert.match(status, /\$t\.State -notin @\('Ready', 'Running'\)/);
  assert.match(status, /task: not eligible to supervise/);
  assert.match(status, /\$ok = \$false/);
  for (const source of [start, status]) {
    assert.doesNotMatch(source, /Start-ScheduledTask|Enable-ScheduledTask|Register-ScheduledTask/);
  }
});

test('PowerShell start and status scripts remain syntactically valid', t => {
  const exe = powershell();
  if (!exe) return t.skip('PowerShell is unavailable');
  for (const file of ['Start-NexusDevops.ps1', 'Test-NexusDevops.ps1']) {
    const script = path.join(root, 'ops/windows', file).replace(/'/g, "''");
    const cmd = "$err=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('" +
      script + "',[ref]$null,[ref]$err);if($err.Count){$err|ForEach-Object{$_.Message};exit 1}";
    const p = spawnSync(exe, ['-NoProfile', '-NonInteractive', '-Command', cmd],
      { encoding: 'utf8', timeout: 30000, windowsHide: true });
    assert.equal(p.status, 0, file + ': ' + p.stdout + p.stderr);
  }
});

test('disabled task is explicitly reported as ineligible by read-only status script', t => {
  if (process.platform !== 'win32') return t.skip('Windows Task Scheduler only');
  const exe = powershell();
  if (!exe) return t.skip('PowerShell is unavailable');
  const task = spawnSync(exe, ['-NoProfile', '-NonInteractive', '-Command',
    "(Get-ScheduledTask -TaskName 'NEXUS-DevOps-Local' -ErrorAction SilentlyContinue).State"],
    { encoding: 'utf8', timeout: 20000, windowsHide: true });
  if (task.status !== 0 || task.stdout.trim() !== 'Disabled') {
    return t.skip('local service task not disabled on this system');
  }
  const script = path.join(root, 'ops/windows/Test-NexusDevops.ps1');
  const statusRun = spawnSync(exe, ['-NoProfile', '-NonInteractive', '-File', script],
    { cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(statusRun.status, 1, statusRun.stdout + statusRun.stderr);
  assert.match(statusRun.stdout, /task: not eligible to supervise a running local service/);
  assert.match(statusRun.stdout, /result: ATTENTION/);
});
