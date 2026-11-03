import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts', 'generate-sbom-offline.py');

function python() {
  for (const candidate of [process.env.NEXUS_ACCEPTANCE_PYTHON, 'python3', 'python'].filter(Boolean)) {
    const probe = spawnSync(candidate, ['--version'],
      { encoding: 'utf8', timeout: 5000, windowsHide: true });
    if (probe.status === 0 && /Python 3\.(1[1-9]|[2-9]\d)/.test(probe.stdout + probe.stderr)) {
      return candidate;
    }
  }
  return null;
}

test('offline SBOM generator is SHA-bound and cannot claim security clearance', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /verify_git\(repo, sha\)/);
  assert.match(source, /"npm_audit": "NOT_RUN"/);
  assert.match(source, /"image_cve_scan": "NOT_RUN"/);
  assert.match(source, /"release_authorized": False/);
  assert.match(source, /"actual_package_integrity_recomputed": False/);
  assert.match(source, /if out_dir\.exists\(\)/);
  assert.match(source, /output_must_be_local_runtime_evidence_directory/);
  assert.doesNotMatch(source, /npm install|npm audit --json|git push|Start-ScheduledTask|fetch\(/);
});

test('offline SBOM generator negative-evidence Python suite passes without network', t => {
  const exe = python();
  if (!exe) return t.skip('Python 3.11+ unavailable');
  const result = spawnSync(exe, ['-B', 'tests/test_generate_sbom_offline.py'],
    { cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
  assert.match(result.stdout + result.stderr, /Ran 13 tests/);
});

test('runbook derives Git source SHA dynamically and documents separate CVE gate', () => {
  const guide = readFileSync(path.join(root, 'docs', 'DEVOPS_OFFLINE_SBOM.md'), 'utf8');
  assert.match(guide, /git -C \$repo rev-parse HEAD/);
  assert.match(guide, /npm_audit=NOT_RUN/);
  assert.match(guide, /release_authorized=false/);
  assert.match(guide, /byte-identical/);
});
