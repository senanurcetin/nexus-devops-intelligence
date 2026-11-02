#!/usr/bin/env node
// On-demand, read-only GitHub check-run annotation inspection. Does not start CI.
import { collectCheckAnnotations, validateAnnotationTarget } from '../src/lib/nexus-check-annotations.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const rest = args.filter(arg => arg !== '--json');
if (rest.length !== 3) {
  process.stderr.write('Usage: node scripts/jarvis-check-annotations.mjs [--json] owner/repo FULL_COMMIT_SHA CHECK_RUN_ID\n');
  process.exitCode = 2;
} else {
  try {
    const [repository, sha, id] = rest;
    validateAnnotationTarget(repository, sha, id);
    const result = await collectCheckAnnotations({ repository, sha, checkRunId: id });
    if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else if (!result.ok) process.stdout.write('Annotations unavailable: ' + result.state + '\n');
    else {
      process.stdout.write(result.sampled_annotations + ' of ' + result.annotation_count +
        ' GitHub check annotations.\n');
      for (const item of result.annotations) {
        process.stdout.write(item.level + ': ' + item.path + ':' + item.start_line + ' ' + item.message + '\n');
      }
      if (result.truncated) process.stdout.write('Sample truncated; inspect source for remaining annotations.\n');
    }
    process.exitCode = result.ok ? 0 : 3;
  } catch (error) {
    process.stderr.write(error instanceof Error ? error.message + '\n' : 'Invalid annotation request\n');
    process.exitCode = 2;
  }
}
