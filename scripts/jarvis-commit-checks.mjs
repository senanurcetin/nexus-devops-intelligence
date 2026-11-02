#!/usr/bin/env node
// Standalone read-only JARVIS bridge. No NEXUS service or paid provider API needed.
// node scripts/jarvis-commit-checks.mjs --json owner/repo <full-commit-sha>
import { collectCommitChecks, validateCommitTarget } from '../src/lib/nexus-commit-checks.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const rest = args.filter(a => a !== '--json');
if (rest.length !== 2) {
  process.stderr.write('Usage: node scripts/jarvis-commit-checks.mjs [--json] owner/repo FULL_COMMIT_SHA\n');
  process.exitCode = 2;
} else {
  try {
    const [repository, sha] = rest;
    validateCommitTarget(repository, sha);
    const result = await collectCommitChecks({ repository, sha });
    if (json) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else {
      process.stdout.write('NEXUS DevOps commit: ' + repository + '@' + sha.slice(0, 12) + '\n');
      process.stdout.write('Coverage: ' + result.coverage + '\n');
      process.stdout.write('Observed: ' + result.counts.failure + ' failing, ' +
        result.counts.pending + ' pending, ' + result.counts.success + ' passing check/status records\n');
      for (const item of result.attention) {
        process.stdout.write('[' + item.provider + '] ' + item.outcome + ' ' + item.name + '\n');
        process.stdout.write('  Next: ' + item.inspection_hint + '\n  ' + item.source_url + '\n');
      }
      if (result.coverage === 'none') process.stdout.write('No verified source available; no CI outcome can be inferred.\n');
    }
    // 1 = observed failing record; 3 = no verified source; 0 = no failing record in available sample.
    process.exitCode = result.coverage === 'none' ? 3 : result.counts.failure ? 1 : 0;
  } catch (error) {
    process.stderr.write(error instanceof Error ? error.message + '\n' : 'Unexpected error\n');
    process.exitCode = 2;
  }
}
