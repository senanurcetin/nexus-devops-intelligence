import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'ops', 'windows', 'Test-NexusDevops.ps1');
const source = readFileSync(file, 'utf8');

function powershell() {
  for (const exe of ['powershell.exe', 'pwsh']) {
    const probe = spawnSync(exe, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8', timeout: 30_000 });
    if (probe.status === 0) return exe;
  }
  return null;
}

test('status script checks every listener and refuses wildcard or non-loopback binds', t => {
  assert.match(source, /\$listeners\s*=\s*@\(Get-NetTCPConnection/);
  assert.match(source, /Test-LoopbackOnly\s+\$listeners/);
  const helper = source.match(/^function Test-LoopbackOnly\([^\r\n]*\)\s*\{[\s\S]*?^\}/m)?.[0];
  assert.ok(helper, 'status script must provide a testable loopback predicate');
  const exe = powershell();
  if (!exe) return t.skip('PowerShell is not available on this machine');

  const cases = [
    [['127.0.0.1'], true],
    [['127.0.0.1', '::1'], true],
    [['127.0.0.1', '0.0.0.0'], false],
    [['::1', '::'], false],
    [['127.0.0.1', '192.168.1.10'], false],
    [['0.0.0.0'], false],
    [[], false],
  ];
  const command = [helper, ...cases.map(([addresses]) => {
    const sockets = addresses.map(address => `[pscustomobject]@{ LocalAddress = '${address}' }`).join(', ');
    return `$listeners = @(${sockets}); if (Test-LoopbackOnly $listeners) { 'true' } else { 'false' }`;
  })].join('\n');
  const run = spawnSync(exe, ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(run.stdout.trim().split(/\r?\n/).map(s => s.trim().toLowerCase()), cases.map(([, expected]) => String(expected)));
});

test('status script remains valid PowerShell', t => {
  const exe = powershell();
  if (!exe) return t.skip('PowerShell is not available on this machine');
  const parse = `$errors=$null; [void][System.Management.Automation.Language.Parser]::ParseFile('${file.replace(/'/g, "''")}',[ref]$null,[ref]$errors); if ($errors.Count) { $errors | ForEach-Object { $_.Message }; exit 1 }`;
  const run = spawnSync(exe, ['-NoProfile', '-NonInteractive', '-Command', parse], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
});
