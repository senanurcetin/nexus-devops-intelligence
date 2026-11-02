import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLocalProject } from '../src/lib/nexus-local-check.ts';

const now = new Date('2026-11-02T12:00:00.000Z');

function envFindings(ignore, paths) {
  const text = { '.gitignore': ignore };
  for (const path of paths) text[path] = 'FICTIONAL_VALUE=fixture';
  const report = analyzeLocalProject({
    rootName: 'synthetic-project',
    filesScanned: Object.keys(text).length,
    truncated: false,
    skippedLarge: 0,
    files: Object.keys(text),
    text,
    git: { present: true, headRef: 'main', detached: false, remoteUrls: [] },
  }, now);
  return new Map(report.findings.filter(f => f.id.startsWith('env-file#'))
    .map(f => [f.file, f.severity]));
}

test('a .gitignore .env entry does not protect .env.production', () => {
  const findings = envFindings('.env\n', ['.env', '.env.production']);
  assert.equal(findings.get('.env'), 'info');
  assert.equal(findings.get('.env.production'), 'high');
});

test('a *.env suffix pattern does not protect .env.local', () => {
  const findings = envFindings('*.env\n', ['.env', '.env.local']);
  assert.equal(findings.get('.env'), 'info');
  assert.equal(findings.get('.env.local'), 'high');
});

test('later gitignore negation re-exposes only the matching .env file', () => {
  const findings = envFindings('.env*\n!.env.production\n',
    ['.env', '.env.production', '.env.local']);
  assert.equal(findings.get('.env'), 'info');
  assert.equal(findings.get('.env.production'), 'high');
  assert.equal(findings.get('.env.local'), 'info');
});

test('root-anchored ignore rule does not cover nested environment files', () => {
  const findings = envFindings('/.env*\n',
    ['.env', '.env.development', 'config/.env.production']);
  assert.equal(findings.get('.env'), 'info');
  assert.equal(findings.get('.env.development'), 'info');
  assert.equal(findings.get('config/.env.production'), 'high');
});

test('unanchored .env* covers nested environment files, .env.example remains exempt', () => {
  const findings = envFindings('.env*\n',
    ['.env', 'config/.env.local', 'config/.env.example']);
  assert.equal(findings.get('.env'), 'info');
  assert.equal(findings.get('config/.env.local'), 'info');
  assert.ok(!findings.has('config/.env.example'));
});

test('unrecognised glob and later unknown negation fail closed rather than claiming ignored', () => {
  const weird = envFindings('.env??\n', ['.env.local']);
  assert.equal(weird.get('.env.local'), 'high');
  const negated = envFindings('.env*\n!config/**\n', ['config/.env.production']);
  assert.equal(negated.get('config/.env.production'), 'high');
});
