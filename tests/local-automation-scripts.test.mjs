import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['Invoke-DevopsAutomation.ps1', 'Install-DevopsAutomation.ps1'].map(name => path.join(root, 'ops', 'windows', name));
const sources = new Map(files.map(file => [file, readFileSync(file, 'utf8')]));

function powershell() {
  for (const exe of ['powershell.exe', 'pwsh']) {
    const probe = spawnSync(exe, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8', timeout: 30_000 });
    if (probe.status === 0) return exe;
  }
  return null;
}

test('automation scripts parse without syntax errors', t => {
  const exe = powershell();
  if (!exe) return t.skip('PowerShell is not available on this machine');
  for (const file of files) {
    const script = `$e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile('${file.replace(/'/g, "''")}',[ref]$null,[ref]$e); if ($e.Count) { $e | ForEach-Object { $_.Message }; exit 1 }`;
    const run = spawnSync(exe, ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 60_000 });
    assert.equal(run.status, 0, `${path.basename(file)}: ${run.stdout}${run.stderr}`);
  }
});

test('automation is read-only: no GitHub writes, deploys, secrets or process-name kills', () => {
  const forbidden = [
    [/git(\.exe)?\s+(-C\s+\S+\s+)?(push|commit|merge|reset|clean|checkout)\b/i, 'git write command'],
    [/\bgh\s+(pr|repo|api|issue)\b/i, 'gh CLI'],
    [/\bvercel\b/i, 'vercel call'],
    [/Stop-Process|Get-Process[^\n]*\|\s*Stop|taskkill[^\n]*\/IM|pkill|killall/i, 'kill by name or pattern'],
    [/gateway\.key|\.env\b|GITHUB_TOKEN|GH_TOKEN|Get-Credential/i, 'secret access'],
    [/Invoke-(Web|Rest)Method\s+-Method\s+(Post|Put|Patch|Delete)/i, 'non-read HTTP verb'],
    [/Remove-Item|Set-ExecutionPolicy|Register-ScheduledTask[^\n]*-RunLevel\s+Highest/i, 'destructive or elevated action'],
  ];
  for (const [file, text] of sources) {
    // Strip comment-based help and line comments so documentation cannot trip the guard.
    const code = text.replace(/<#[\s\S]*?#>/g, '').replace(/^\s*#.*$/gm, '');
    for (const [pattern, label] of forbidden) {
      assert.ok(!pattern.test(code), `${path.basename(file)} contains ${label}: ${pattern}`);
    }
  }
});

test('automation only talks to loopback and anonymous api.github.com', () => {
  const text = sources.get(files[0]);
  const urls = [...text.matchAll(/https?:\/\/[^\s'"`)]+/g)].map(match => match[0]);
  for (const url of urls) {
    assert.match(url, /^(http:\/\/127\.0\.0\.1[:/$]|https:\/\/api\.github\.com\/rate_limit$)/, `unexpected URL ${url}`);
  }
  assert.ok(!/Authorization|Bearer/i.test(text.replace(/\(\?i\)\(token[^\n]*/g, '')), 'no auth header may be sent');
});

test('installer registers exactly the three documented tasks, non-elevated', () => {
  const text = sources.get(files[1]);
  for (const name of ['NEXUS-DevOps-Health', 'NEXUS-DevOps-Watch', 'NEXUS-DevOps-Gate']) assert.ok(text.includes(name), name);
  assert.match(text, /-RunLevel Limited/);
  assert.match(text, /-MultipleInstances IgnoreNew/);
  assert.match(text, /SupportsShouldProcess/);
  assert.ok(!/-RunLevel Highest/.test(text));
});

test('automation redacts secret-looking values before writing child output', () => {
  const text = sources.get(files[0]);
  assert.match(text, /function Get-Redacted/);
  assert.match(text, /github_pat_/);
});
