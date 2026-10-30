import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectLocalFacts, assertScannableRoot } from '../src/lib/nexus-local-check-collect.ts';

test('local checker refuses a symlink or junction as the selected project root', t => {
  const temporary = mkdtempSync(join(tmpdir(), 'nexus-lc-root-'));
  const project = join(temporary, 'project');
  const linked = join(temporary, 'link');
  try {
    mkdirSync(project);
    writeFileSync(join(project, 'README.md'), 'fixture only');
    try {
      symlinkSync(project, linked, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      t.skip('directory symlinks unavailable: ' + (error?.code ?? 'unknown'));
      return;
    }
    assert.throws(() => assertScannableRoot(linked), /symlink|symbolic|link/i);
    assert.throws(() => collectLocalFacts(linked), /symlink|symbolic|link/i);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('local checker never follows .git HEAD or config file symlinks', t => {
  const temporary = mkdtempSync(join(tmpdir(), 'nexus-lc-gitlinks-'));
  const project = join(temporary, 'project');
  const outside = join(temporary, 'outside');
  try {
    mkdirSync(join(project, '.git'), { recursive: true });
    mkdirSync(outside);
    writeFileSync(join(outside, 'HEAD'), 'ref: refs/heads/private-branch\n');
    writeFileSync(join(outside, 'config'), '[remote "private"]\nurl = https://test-only:test-only@github.com/elsewhere/private.git\n');
    try {
      symlinkSync(join(outside, 'HEAD'), join(project, '.git', 'HEAD'), 'file');
      symlinkSync(join(outside, 'config'), join(project, '.git', 'config'), 'file');
    } catch (error) {
      t.skip('file symlinks unavailable: ' + (error?.code ?? 'unknown'));
      return;
    }
    const scanned = collectLocalFacts(project);
    assert.equal(scanned.git.headRef, null);
    assert.equal(scanned.git.detached, false);
    assert.deepEqual(scanned.git.remoteUrls, []);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('oversized git config is not loaded even if it begins with a remote URL', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'nexus-lc-gitbound-'));
  try {
    const git = join(temporary, '.git');
    mkdirSync(git);
    writeFileSync(join(git, 'HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(join(git, 'config'),
      '[remote "test"]\nurl = https://github.com/a/b.git\n' + '#'.repeat(300 * 1024));
    const scanned = collectLocalFacts(temporary);
    assert.equal(scanned.git.present, true);
    assert.equal(scanned.git.headRef, 'main');
    assert.deepEqual(scanned.git.remoteUrls, []);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('normal local Git metadata still works after bounded reads', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'nexus-lc-gitvalid-'));
  try {
    const git = join(temporary, '.git');
    mkdirSync(git);
    writeFileSync(join(git, 'HEAD'), 'ref: refs/heads/feature/safe\n');
    writeFileSync(join(git, 'config'),
      '[remote "origin"]\nurl = https://github.com/example/project.git\n');
    const scanned = collectLocalFacts(temporary);
    assert.equal(scanned.git.headRef, 'feature/safe');
    assert.deepEqual(scanned.git.remoteUrls, ['https://github.com/example/project.git']);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
