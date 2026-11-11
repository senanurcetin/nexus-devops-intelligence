// Shared logic for the action.yml entry point (scripts/action-commit-checks.mjs).
// Read-only: GET requests to api.github.com via collectCommitChecks; writes step outputs/summary.
import { appendFileSync } from 'node:fs';
import { collectCommitChecks, validateCommitTarget } from './nexus-commit-checks.mjs';

// Escape Markdown table-cell metacharacters; backslash first so later escapes stay intact.
export function cell(value) {
  return String(value).replace(/[\r\n]+/g, ' ').replace(/[\\|[\]`*_<>]/g, c => '\\' + c);
}

export function formatSummary(repository, sha, result) {
  const lines = [
    '### NEXUS commit checks',
    '',
    '`' + repository + '@' + sha.slice(0, 12) + '` · coverage: **' + result.coverage + '**',
    '',
    '| Failing | Pending | Passing |',
    '| --- | --- | --- |',
    '| ' + result.counts.failure + ' | ' + result.counts.pending + ' | ' + result.counts.success + ' |',
  ];
  if (result.truncated?.checks || result.truncated?.commit_statuses) {
    lines.push('', 'The GitHub sample was truncated. Counts may be incomplete.');
  }
  if (result.attention.length > 0) {
    lines.push('', '| Provider | Outcome | Check | Next step |', '| --- | --- | --- | --- |');
    for (const item of result.attention) {
      const url = encodeURI(item.source_url).replace(/[()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
      lines.push('| ' + cell(item.provider) + ' | ' + cell(item.outcome) + ' | [' + cell(item.name) + '](' + url + ') | ' +
        cell(item.inspection_hint) + ' |');
    }
  }
  if (result.coverage === 'none') lines.push('', 'No verified source was available; no CI outcome can be inferred.');
  return lines.join('\n') + '\n';
}

export async function runAction(env = process.env, collect = collectCommitChecks) {
  const repository = env.INPUT_REPOSITORY ?? '';
  const sha = (env.INPUT_SHA ?? '').toLowerCase();
  validateCommitTarget(repository, sha);
  const result = await collect({ repository, sha });
  if (env.GITHUB_OUTPUT) {
    appendFileSync(env.GITHUB_OUTPUT, [
      'coverage=' + result.coverage,
      'failure-count=' + result.counts.failure,
      'pending-count=' + result.counts.pending,
      'success-count=' + result.counts.success,
    ].join('\n') + '\n');
  }
  const summary = formatSummary(repository, sha, result);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
  process.stdout.write(summary);
  const failOnFailure = (env.INPUT_FAIL_ON_FAILURE ?? 'true').trim().toLowerCase() !== 'false';
  return failOnFailure && result.counts.failure > 0 ? 1 : 0;
}
