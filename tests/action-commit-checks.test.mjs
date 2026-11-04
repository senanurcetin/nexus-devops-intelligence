import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cell, formatSummary, runAction } from '../src/lib/nexus-action-commit-checks.mjs';

const SHA = 'a'.repeat(40);

function report(counts, attention = [], coverage = 'both_sources') {
  return { coverage, counts: { failure: 0, pending: 0, success: 0, other: 0, ...counts }, attention };
}

function env(extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'nexus-action-'));
  return {
    INPUT_REPOSITORY: 'octo/repo',
    INPUT_SHA: SHA,
    GITHUB_OUTPUT: join(dir, 'out'),
    GITHUB_STEP_SUMMARY: join(dir, 'summary'),
    ...extra,
  };
}

test('action.yml points at an existing entry script and declares documented inputs', () => {
  const yml = readFileSync(new URL('../action.yml', import.meta.url), 'utf8');
  assert.match(yml, /using: composite/);
  assert.ok(existsSync(new URL('../scripts/action-commit-checks.mjs', import.meta.url)));
  for (const name of ['repository:', 'sha:', 'token:', 'fail-on-failure:', 'failure-count:']) {
    assert.ok(yml.includes(name), 'missing ' + name);
  }
});

test('writes outputs and step summary, and fails on observed failures by default', async () => {
  const e = env();
  const failing = { provider: 'github-actions', outcome: 'failure', name: 'test | unit',
    source_url: 'https://github.com/octo/repo/runs/1', inspection_hint: 'Open the failing test.' };
  const code = await runAction(e, async () => report({ failure: 1, success: 2 }, [failing]));
  assert.equal(code, 1);
  const out = readFileSync(e.GITHUB_OUTPUT, 'utf8');
  assert.match(out, /^coverage=both_sources$/m);
  assert.match(out, /^failure-count=1$/m);
  assert.match(out, /^success-count=2$/m);
  const summary = readFileSync(e.GITHUB_STEP_SUMMARY, 'utf8');
  assert.match(summary, /test \\\| unit/, 'pipes in check names are escaped for the markdown table');
});

test('fail-on-failure=false keeps the step green', async () => {
  const code = await runAction(env({ INPUT_FAIL_ON_FAILURE: 'false' }), async () => report({ failure: 3 }));
  assert.equal(code, 0);
});

test('rejects invalid targets before any request', async () => {
  let called = false;
  await assert.rejects(runAction(env({ INPUT_SHA: 'main' }), async () => { called = true; }));
  assert.equal(called, false);
});

test('cell escapes backslashes before other Markdown metacharacters', () => {
  assert.equal(cell('a\\|b'), 'a\\\\\\|b');
  assert.equal(cell('[x](y)\nz'), '\\[x\\](y) z');
});

test('summary explains when no source could be verified', () => {
  assert.match(formatSummary('octo/repo', SHA, report({}, [], 'none')), /no CI outcome can be inferred/);
});
