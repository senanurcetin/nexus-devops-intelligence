import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helper = path.join(root, 'ops', 'windows', 'DevopsServiceIdentity.ps1');
const files = ['DevopsServiceIdentity.ps1', 'Start-NexusDevops.ps1', 'Test-NexusDevops.ps1',
  'Invoke-DevopsAutomation.ps1'].map(file => path.join(root, 'ops', 'windows', file));

function powershell() {
  for (const exe of ['powershell.exe', 'pwsh']) {
    const probe = spawnSync(exe, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'],
      { encoding: 'utf8', timeout: 30_000 });
    if (probe.status === 0) return exe;
  }
  return null;
}

test('each probe uses shared fail-closed service identity and listener contract', () => {
  for (const file of files.slice(1)) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /DevopsServiceIdentity\.ps1/);
    assert.match(source, /Test-NexusDevopsPage/);
    assert.match(source, /Test-NexusDevopsLoopback/);
    assert.match(source, /http:\/\/127\.0\.0\.1:/);
  }
  const source = readFileSync(helper, 'utf8');
  assert.match(source, /-cmatch '<title>/);
  assert.match(source, /NEXUS DevOps Intelligence/);
  assert.doesNotMatch(source, /Invoke-WebRequest|Invoke-RestMethod|Start-Process|Stop-Process/);
});

test('PowerShell scripts remain syntactically valid', t => {
  const exe = powershell();
  if (!exe) return t.skip('PowerShell is not available');
  for (const file of files) {
    const literal = file.replace(/'/g, "''");
    const command = "$e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile('" +
      literal + "',[ref]$null,[ref]$e); if ($e.Count) { $e | ForEach-Object { $_.Message }; exit 1 }";
    const run = spawnSync(exe, ['-NoProfile', '-NonInteractive', '-Command', command],
      { encoding: 'utf8', timeout: 30_000 });
    assert.equal(run.status, 0, path.basename(file) + ': ' + run.stdout + run.stderr);
  }
});

test('foreign HTTP 200 pages and external port binds are rejected', t => {
  const exe = powershell();
  if (!exe) return t.skip('PowerShell is not available');
  const good = '<html><head><title>NEXUS DevOps Intelligence</title></head></html>';
  const pages = [
    [200, good, true],
    [200, '<title>Different service</title>', false],
    [200, '<title>NEXUS DevOps Intelligence - different</title>', false],
    [201, good, false],
    [302, good, false],
    [401, good, false],
    [404, good, false],
    [500, good, false],
    [200, '', false],
  ];
  const commands = [". '" + helper.replace(/'/g, "''") + "'"];
  for (const [status, body] of pages) {
    commands.push("if (Test-NexusDevopsPage -StatusCode " + status +
      " -Body '" + body.replace(/'/g, "''") + "') { 'true' } else { 'false' }");
  }
  const addresses = [
    [['127.0.0.1'], true], [['::1'], true], [['127.0.0.1', '::1'], true],
    [['127.0.0.1', '0.0.0.0'], false], [['::1', '::'], false],
    [[], false], [['192.168.1.20'], false],
  ];
  for (const [values] of addresses) {
    const sockets = values.map(value => "[pscustomobject]@{ LocalAddress = '" + value + "' }").join(', ');
    commands.push('$sockets = @(' + sockets + "); if (Test-NexusDevopsLoopback -Sockets $sockets) { 'true' } else { 'false' }");
  }
  const run = spawnSync(exe, ['-NoProfile', '-NonInteractive', '-Command', commands.join('\n')],
    { encoding: 'utf8', timeout: 30_000 });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.deepEqual(run.stdout.trim().split(/\r?\n/).map(x => x.trim().toLowerCase()),
    [...pages.map(x => String(x[2])), ...addresses.map(x => String(x[1]))]);
});
