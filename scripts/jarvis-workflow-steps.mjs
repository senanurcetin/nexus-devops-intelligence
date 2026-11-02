#!/usr/bin/env node
// Offline Next dashboard is fine; explicit failed-run read from public GitHub only.
import { collectWorkflowSteps, validateWorkflowTarget } from '../src/lib/nexus-jarvis-workflow-steps.mjs';

const args = process.argv.slice(2).filter(a => a !== '--json');
const json = process.argv.includes('--json');
if (args.length !== 3) {
  process.stderr.write('Usage: node --import tsx scripts/jarvis-workflow-steps.mjs [--json] owner/repo FULL_SHA RUN_ID\n');
  process.exitCode = 2;
} else {
  try {
    const [repository, sha, runId] = args;
    validateWorkflowTarget(repository, sha, runId);
    const result = await collectWorkflowSteps({ repository, sha, runId });
    if (json) process.stdout.write(JSON.stringify(result) + '\n');
    else if (!result.ok) process.stdout.write('Workflow steps unavailable: ' + result.state + '\n');
    else {
      process.stdout.write('GitHub Actions failed run #' + result.workflow_run_id + ' attempt ' +
        result.run_attempt + ': ' + result.sampled_jobs + '/' + result.total_jobs + ' jobs sampled\n');
      for (const job of result.jobs) {
        process.stdout.write(job.name + ': ' + (job.conclusion ?? job.status) + '\n');
        for (const step of job.steps) process.stdout.write(
          '  ' + step.number + '. ' + step.name + ': ' + (step.conclusion ?? step.status) + '\n');
      }
      if (result.truncated.jobs || result.truncated.steps) {
        process.stdout.write('Sample incomplete; source should be inspected manually.\n');
      }
    }
    process.exitCode = result.ok ? 0 : 3;
  } catch (error) {
    process.stderr.write(error instanceof Error ? error.message + '\n' : 'Invalid input\n');
    process.exitCode = 2;
  }
}
