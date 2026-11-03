import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helper = path.join(root, 'ops', 'windows', 'DevopsBuildStatus.ps1');
const launcher = readFileSync(path.join(root, 'ops', 'windows', 'Start-NexusDevops.ps1'), 'utf8');
const status = readFileSync(path.join(root, 'ops', 'windows', 'Test-NexusDevops.ps1'), 'utf8');

function command(exe, args, cwd) {
  const r = spawnSync(exe, args, { cwd, encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(r.status, 0, exe + ' ' + args.join(' ') + ': ' + r.stdout + r.stderr);
  return r.stdout.trim();
}
function powershell() {
  for (const name of ['powershell.exe', 'pwsh']) {
    const r = spawnSync(name, ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.Major'],
      { encoding: 'utf8', timeout: 15000, windowsHide: true });
    if (r.status === 0) return name;
  }
  return null;
}
function state(exe, repo) {
  const literal = value => value.replace(/'/g, "''");
  const code = ". '" + literal(helper) + "'; (Get-NexusDevopsBuildStatus -RepoRoot '" + literal(repo) + "').State";
  return command(exe, ['-NoProfile', '-NonInteractive', '-Command', code], repo);
}

test('local service refuses stale and unverified builds, and guards first build RAM', () => {
  assert.match(launcher, /DevopsBuildStatus\.ps1/);
  assert.match(launcher, /\$build\.State -in @\('stale', 'unknown'\)/);
  assert.match(launcher, /if \(\$build\.State -ne 'current'\)/);
  assert.match(launcher, /\$freeRamMb -lt 4096/);
  assert.match(status, /DevopsBuildStatus\.ps1/);
  assert.match(status, /if \(\$build\.State -ne 'current'\) \{ \$ok = \$false \}/);
});

test('helper and callers remain valid Windows PowerShell scripts', t => {
  const exe = powershell();
  if (!exe) return t.skip('PowerShell not available');
  for (const name of ['DevopsBuildStatus.ps1', 'Start-NexusDevops.ps1', 'Test-NexusDevops.ps1']) {
    const file = path.join(root, 'ops', 'windows', name).replace(/'/g, "''");
    const code = "$errors = $null; [void][System.Management.Automation.Language.Parser]::ParseFile('" +
      file + "',[ref]$null,[ref]$errors); if($errors.Count){$errors|ForEach-Object {$_.Message};exit 1}";
    command(exe, ['-NoProfile', '-NonInteractive', '-Command', code], root);
  }
});

test('a synthetic local git repo tests missing, current, stale, dirty and unknown build', t => {
  const exe = powershell();
  if (!exe) return t.skip('PowerShell not available');
  const temp = mkdtempSync(path.join(tmpdir(), 'nexus-devops-build-status-'));
  try {
    command('git', ['init', '-q'], temp);
    const src = path.join(temp, 'src');
    mkdirSync(src);
    const app = path.join(src, 'index.ts');
    writeFileSync(app, 'export const value = 1;\n');
    command('git', ['add', 'src/index.ts'], temp);
    command('git', ['-c', 'user.name=NEXUS-QA', '-c', 'user.email=qa@localhost',
      'commit', '--quiet', '-m', 'initial app'], temp);
    assert.equal(state(exe, temp), 'missing');
    writeFileSync(app, 'export const value = 2;\n');
    assert.equal(state(exe, temp), 'stale', 'dirty application cannot trigger the first auto-build');
    writeFileSync(app, 'export const value = 1;\n');

    const buildDir = path.join(temp, '.next');
    mkdirSync(buildDir);
    const buildId = path.join(buildDir, 'BUILD_ID');
    writeFileSync(buildId, 'test-build');
    const later = new Date(Date.now() + 120000);
    utimesSync(buildId, later, later);
    assert.equal(state(exe, temp), 'current');

    writeFileSync(path.join(temp, 'README.md'), 'documentation only');
    assert.equal(state(exe, temp), 'current', 'untracked docs do not make app build stale');
    command('git', ['add', 'README.md'], temp);
    command('git', ['-c', 'user.name=NEXUS-QA', '-c', 'user.email=qa@localhost',
      'commit', '--quiet', '-m', 'docs only'], temp);
    assert.equal(state(exe, temp), 'current', 'a documentation-only commit does not require rebuilding');

    const older = new Date(Date.now() - 180000);
    utimesSync(buildId, older, older);
    assert.equal(state(exe, temp), 'stale');

    utimesSync(buildId, later, later);
    writeFileSync(app, 'export const value = 2;\n');
    assert.equal(state(exe, temp), 'stale', 'dirty app source must fail closed');

    rmSync(path.join(temp, '.git'), { recursive: true, force: true });
    assert.equal(state(exe, temp), 'unknown', 'missing Git evidence must not pass');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
