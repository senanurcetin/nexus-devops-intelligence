import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { checkThreePrComposition } from '../scripts/verify-pr-composition.mjs';

const git = (cwd, ...args) => execFileSync('git', args, {
  cwd, encoding:'utf8', stdio:['ignore','pipe','pipe'],
}).trim();
const commitFile = async (dir, file, value) => {
  await writeFile(join(dir, file), value);
  git(dir, 'add', file);
  git(dir, '-c', 'user.name=NEXUS Test', '-c', 'user.email=local@localhost.invalid',
    'commit', '-q', '-m', 'Commit ' + file);
  return git(dir, 'rev-parse', 'HEAD');
};
async function fixture(callback, { conflict = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'nexus-merge-'));
  try {
    git(dir, 'init', '-q', '-b', 'main');
    const base = await commitFile(dir, 'readme.txt', 'main\n');
    git(dir, 'switch', '-q', '-c', 'product');
    const product = await commitFile(dir, conflict ? 'readme.txt' : 'product.txt', 'product\n');
    git(dir, 'switch', '-q', 'main');
    git(dir, 'switch', '-q', '-c', 'community');
    const community = await commitFile(dir, conflict ? 'readme.txt' : 'community.txt', 'community\n');
    git(dir, 'switch', '-q', 'main');
    git(dir, 'switch', '-q', '-c', 'evidence');
    const evidence = await commitFile(dir, 'evidence.txt', 'evidence\n');
    git(dir, 'switch', '-q', 'main');
    await callback(dir, { base, product, community, evidence });
  } finally { await rm(dir, { recursive:true, force:true }); }
}
const execute = (dir, refs) => checkThreePrComposition({ cwd: dir, ...refs });

test('all three PRs synthesize to same source tree without touching refs or worktree', async () => {
  await fixture(async (dir, refs) => {
    const beforeHead = git(dir, 'rev-parse', 'HEAD');
    const beforeRefs = git(dir, 'for-each-ref', '--format=%(refname):%(objectname)');
    const result = execute(dir, refs);
    assert.equal(result.compatibility, 'CLEAN_MERGE_LOCAL_ONLY');
    assert.equal(result.release_authorized, false);
    assert.equal(result.git_refs_updated, false);
    assert.equal(result.git_objects_written, true);
    assert.equal(result.combined_tree.length, 40);
    assert.deepEqual(result.pairwise.map(x => x.status),
      ['CLEAN_MERGE','CLEAN_MERGE','CLEAN_MERGE']);
    assert.equal(git(dir, 'show', result.combined_tree + ':product.txt'), 'product');
    assert.equal(git(dir, 'show', result.combined_tree + ':community.txt'), 'community');
    assert.equal(git(dir, 'show', result.combined_tree + ':evidence.txt'), 'evidence');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), beforeHead);
    assert.equal(git(dir, 'for-each-ref', '--format=%(refname):%(objectname)'), beforeRefs);
    assert.equal(git(dir, 'status', '--porcelain'), '');
  });
});

test('textual conflict in any branch pair fails closed without writing branch refs', async () => {
  await fixture(async (dir, refs) => {
    const beforeRefs = git(dir, 'for-each-ref', '--format=%(refname):%(objectname)');
    assert.throws(() => execute(dir, refs), /merge simulation failed/i);
    assert.equal(git(dir, 'for-each-ref', '--format=%(refname):%(objectname)'), beforeRefs);
    assert.equal(git(dir, 'status', '--porcelain'), '');
  }, { conflict: true });
});

test('dirty tracked source is rejected and is not modified by the tool', async () => {
  await fixture(async (dir, refs) => {
    await writeFile(join(dir, 'readme.txt'), 'dirty tracked local change');
    assert.throws(() => execute(dir, refs), /dirty tracked checkout/);
    assert.equal(await readFile(join(dir, 'readme.txt'), 'utf8'), 'dirty tracked local change');
  });
});

test('untracked files do not masquerade as source or get destroyed', async () => {
  await fixture(async (dir, refs) => {
    const p = join(dir, 'local-user-note.txt');
    await writeFile(p, 'do not touch');
    assert.equal(execute(dir, refs).release_authorized, false);
    assert.equal(await readFile(p, 'utf8'), 'do not touch');
  });
});

test('injected shell expressions, short SHA IDs, duplicate heads and wrong base reject', async () => {
  await fixture(async (dir, refs) => {
    assert.throws(() => execute(dir, { ...refs, evidence:'main;echo injected' }), /Four distinct/);
    assert.throws(() => execute(dir, { ...refs, product:refs.product.slice(0, 8) }), /Four distinct/);
    assert.throws(() => execute(dir, { ...refs, product:refs.community }), /Four distinct/);
    assert.throws(() => execute(dir, { ...refs, base:'a'.repeat(40) }), /not a commit|Git verification/);
  });
});

test('all PRs must descend from the same base', async () => {
  await fixture(async (dir, refs) => {
    const alternate = git(dir, 'rev-parse', 'HEAD');
    git(dir, 'switch', '-q', 'product');
    const newestProduct = await commitFile(dir, 'later.txt', 'product after base\n');
    git(dir, 'switch', '-q', 'main');
    // Ancestor check passes for only one PR, not all; never infer compatibility.
    assert.throws(() => execute(dir, {
      ...refs, base:refs.product, product:newestProduct,
    }), /not descended from the pinned base/);
    assert.equal(git(dir,'rev-parse','HEAD'), alternate);
  });
});

test('CLI outputs only local compatibility, requires explicit exact SHAs and no release PASS', async () => {
  await fixture(async (dir, refs) => {
    const script = join(import.meta.dirname, '..','scripts','verify-pr-composition.mjs');
    const goodArgs = ['--base',refs.base,'--product',refs.product,
      '--community',refs.community,'--evidence',refs.evidence];
    const p = spawnSync(process.execPath,[script,...goodArgs],{cwd:dir,encoding:'utf8'});
    assert.equal(p.status,0);
    const result = JSON.parse(p.stdout);
    assert.equal(result.compatibility,'CLEAN_MERGE_LOCAL_ONLY');
    assert.equal(result.release_authorized,false);
    assert.match(result.unresolved_acceptance.join(' '),/independent_native_ubuntu/);
    const bad = spawnSync(process.execPath,[script,'--base',refs.base],{
      cwd:dir,encoding:'utf8',
    });
    assert.equal(bad.status,3);
    assert.equal(JSON.parse(bad.stderr).release_authorized,false);
    assert.equal(JSON.parse(bad.stderr).compatibility,'HOLD');
  });
});
