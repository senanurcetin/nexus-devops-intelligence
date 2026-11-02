import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLocalProject, localCheckMarkdown } from '../src/lib/nexus-local-check.ts';

const now = new Date('2026-11-02T12:00:00.000Z');
const credentials = [
  'synthetic-credential-' + 'abcdef1234567890',
  'synthetic-query-' + 'abcdef1234567890',
  'synthetic-fragment-' + 'abcdef1234567890',
];
function scan(remotes) {
  return analyzeLocalProject({
    rootName: 'local-project',
    filesScanned: 1,
    truncated: false,
    skippedLarge: 0,
    files: ['README.md'],
    text: { 'README.md': 'Synthetic read-only fixture' },
    git: { present: true, headRef: 'main', detached: false, remoteUrls: remotes },
  }, now);
}

test('local-check JSON and Markdown never echo remote credentials from URL userinfo, query or fragment', () => {
  const remote =
    'https://member:' + credentials[0] +
    '@github.com/example/project.git?access_token=' + credentials[1] +
    '#password=' + credentials[2];
  const report = scan([remote]);
  const output = JSON.stringify(report) + localCheckMarkdown(report);
  for (const value of credentials) {
    assert.ok(!output.includes(value), 'must not expose a synthetic credential in diagnostic output');
  }
  assert.deepEqual(report.facts.git.remotes, ['https://github.com/example/project.git']);
  assert.ok(report.findings.some(f => f.id.startsWith('git-remote-credentials')));
});

test('remote URL without userinfo still strips query and fragment', () => {
  const remote = 'https://github.com/example/project.git?private=' + credentials[1] +
    '#key=' + credentials[2];
  const report = scan([remote]);
  assert.deepEqual(report.facts.git.remotes, ['https://github.com/example/project.git']);
  assert.ok(!JSON.stringify(report).includes(credentials[1]));
  assert.ok(!JSON.stringify(report).includes(credentials[2]));
});

test('SSH-style remotes stay useful while URL query secrets are redacted', () => {
  const report = scan([
    'git@github.com:example/project.git',
    'ssh://git@github.com/example/project.git?password=' + credentials[1],
  ]);
  assert.equal(report.facts.git.remotes[0], 'git@github.com:example/project.git');
  assert.equal(report.facts.git.remotes[1], 'ssh://github.com/example/project.git');
  assert.ok(!JSON.stringify(report).includes(credentials[1]));
});

test('malformed remote URL does not reveal query fields in output', () => {
  const remote = 'https://[broken-host/example/project.git?secret=' + credentials[1];
  const report = scan([remote]);
  assert.ok(!JSON.stringify(report).includes(credentials[1]));
  assert.ok(!localCheckMarkdown(report).includes(credentials[1]));
});

test('query access tokens are reported as credential risk even without URL userinfo', () => {
  const url = 'https://github.com/example/project.git?access_token=' + credentials[1];
  const report = scan([url]);
  assert.equal(report.findings.filter(f => f.id.startsWith('git-remote-credentials')).length, 1);
  assert.equal(report.findings.find(f => f.id.startsWith('git-remote-credentials')).severity, 'high');
  assert.ok(!JSON.stringify(report).includes(credentials[1]));
});

test('provider-shaped credential segments in URL path are hidden', () => {
  const synthetic = 'gh' + 'p_' + 'a1B2c3D4e5'.repeat(4);
  const report = scan(['https://github.com/' + synthetic + '/sample.git']);
  assert.deepEqual(report.facts.git.remotes, ['https://github.com/[path hidden]']);
  assert.ok(!JSON.stringify(report).includes(synthetic));
});
