#!/usr/bin/env node
/**
 * Offline, source-pinned three-PR Git composition preflight.
 *
 * Reads ONLY existing local Git commit identities. Uses merge-tree and
 * commit-tree to create unreachable local Git objects; never updates refs,
 * branches or working-tree files, executes test suites, accesses a network,
 * performs a remote merge, or grants release approval.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sha40 = /^[0-9a-f]{40}$/;
const SHA_KEYS = Object.freeze(['base', 'product', 'community', 'evidence']);
const failure = message => Object.assign(new Error(message), { code: 'INTEGRATION_HOLD' });

function runGit(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd, encoding: 'utf8', timeout: 30_000, maxBuffer: 256 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw failure('Local Git verification or merge simulation failed.');
  }
}
function isObjectCommit(cwd, sha) {
  return runGit(cwd, ['cat-file', '-t', sha]) === 'commit';
}
function mergeTree(cwd, left, right) {
  // Git >= 2.38. Exit nonzero on textual conflicts; first line is a tree ID.
  const output = runGit(cwd, ['merge-tree', '--write-tree', left, right]);
  const tree = output.split('\n')[0]?.trim();
  if (!sha40.test(tree)) throw failure('Merge simulation did not produce a valid tree.');
  return tree;
}
function transientCommit(cwd, tree, parents, description) {
  const args = [
    '-c', 'user.name=NEXUS Local QA',
    '-c', 'user.email=nexus-qa@localhost.invalid',
    'commit-tree', tree,
    ...parents.flatMap(sha => ['-p', sha]),
    '-m', description,
  ];
  const commit = runGit(cwd, args);
  if (!sha40.test(commit)) throw failure('Cannot create temporary local Git object.');
  return commit;
}

/**
 * A compatible source tree is NOT an authenticated build, image acceptance,
 * release policy PASS, or a merge authorization.
 *
 * args must contain full SHA-1 Git commit identities from a prior authenticated
 * repository lookup, not mutable branch refs.
 */
export function checkThreePrComposition({ cwd = process.cwd(), base, product, community, evidence }) {
  const shaList = [base, product, community, evidence];
  if (!shaList.every(sha => typeof sha === 'string' && sha40.test(sha)) ||
      new Set(shaList).size !== shaList.length)
    throw failure('Four distinct pinned 40-character lowercase Git SHAs are required.');
  const repo = resolve(cwd);
  if (runGit(repo, ['rev-parse', '--is-inside-work-tree']) !== 'true')
    throw failure('Run from an existing local Git checkout.');
  // Never imply that a dirty checkout was part of the observed composition.
  if (runGit(repo, ['status', '--porcelain', '--untracked-files=no']))
    throw failure('Refusing source acceptance from a dirty tracked checkout.');
  for (const sha of shaList) {
    if (!isObjectCommit(repo, sha)) throw failure('Pinned Git object is not a commit.');
  }
  for (const sha of [product, community, evidence]) {
    if (runGit(repo, ['merge-base', base, sha]) !== base)
      throw failure('PR source is not descended from the pinned base.');
  }
  const pairs = [
    ['product', 'community', product, community],
    ['product', 'evidence', product, evidence],
    ['community', 'evidence', community, evidence],
  ];
  const combinedPairs = [];
  for (const [leftLabel, rightLabel, left, right] of pairs) {
    if (runGit(repo, ['merge-base', left, right]) !== base)
      throw failure('PR branches have different merge bases.');
    const tree = mergeTree(repo, left, right);
    combinedPairs.push({ pair: leftLabel + '+' + rightLabel, status: 'CLEAN_MERGE', tree });
  }
  // Reproduce the tested order #95 product + #80 Community + #96 evidence.
  // The synthetic commits are unreachable objects: no refs or worktrees move.
  const first = transientCommit(repo, combinedPairs[0].tree,
    [product, community], 'NEXUS local-only product and Community compatibility');
  const threeTree = mergeTree(repo, first, evidence);
  return {
    schema_version: 1,
    purpose: 'OFFLINE_PR_COMPOSITION',
    compatibility: 'CLEAN_MERGE_LOCAL_ONLY',
    release_authorized: false,
    main_unchanged: true,
    git_refs_updated: false,
    git_objects_written: true,
    source_shas: { base, product, community, evidence },
    pairwise: combinedPairs,
    combined_tree: threeTree,
    unresolved_acceptance: [
      'real_exact_tree_test_execution',
      'actual_combined_docker_image_cve',
      'independent_native_ubuntu',
      'protected_exact_sha_preview',
      'independent_redis_instances',
      'human_accessibility_and_release_approval',
    ],
  };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length !== SHA_KEYS.length * 2 ||
      SHA_KEYS.some((name, i) => argv[2 * i] !== '--' + name))
    throw failure('Usage: --base SHA --product SHA --community SHA --evidence SHA');
  const refs = Object.fromEntries(SHA_KEYS.map((name, i) => [name, argv[2 * i + 1]]));
  const result = checkThreePrComposition(refs);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  // Exit 0 means only local Git composition compatibility, not release approval.
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(JSON.stringify({
      compatibility: 'HOLD',
      release_authorized: false,
      reason: error?.code === 'INTEGRATION_HOLD'
        ? error.message : 'Cannot safely verify local PR composition.',
    }) + '\n');
    process.exitCode = 3;
  });
}
