import type { SampleExportInput } from './nexus-public-sample-export.ts';
import { createPublicSampleExport, createSampleFilename } from './nexus-public-sample-export.ts';
import { recommendInvestigations } from './nexus-recommendations.ts';

/**
 * Client-only handoff of up to five source-backed investigation suggestions.
 * Never fetches, stores, retries, diagnoses root causes or grants merge approval.
 * Uses ALL verified rows, independently of the dashboard's visual filters.
 */
const safeMarkdownText = (value: string, limit = 420): string => value
  .slice(0, limit)
  .replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2069\ufeff]/g, ' ')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/[\\\x60*_{}\[\]()#+.!|~-]/g, '\\$&')
  .trim();

export function createInvestigationHandoff(input: SampleExportInput): {
  filename: string; markdown: string;
} {
  const snapshot = createPublicSampleExport({
    ...input, workflowFilter: 'all', pullFilter: 'all',
  });
  const sourceRoot = 'https://github.com/' + snapshot.repository;
  const suggestions = recommendInvestigations(input.actions, input.prs);
  const lines = [
    '# NEXUS DevOps — Investigation Handoff',
    '',
    '> Read-only, bounded public GitHub sample. Prioritization is deterministic triage,',
    '> not incident root-cause proof, an exhaustive repository audit, merge permission',
    '> or production release approval.',
    '',
    '## Evidence scope',
    '',
    '- Repository: [' + safeMarkdownText(snapshot.repository) + '](' + sourceRoot + ')',
    '- Exported (UTC): ' + safeMarkdownText(snapshot.exported_at_utc),
    '- API source: public GitHub REST; no private repository access',
    '- Workflow sample cap: 10 recent runs; open PR cap: 5 recent PRs',
    '- Visual filters: ignored for this queue so previously verified alerts cannot be hidden',
  ];
  if (snapshot.actions) {
    lines.push('- Actions receipt (UTC): ' + safeMarkdownText(snapshot.actions.received_at_utc),
      '- Inspected workflows: ' + snapshot.actions.inspected_runs +
      ' of ' + snapshot.actions.total_matching_runs + ' matching runs');
  } else {
    lines.push('- Actions: UNAVAILABLE / UNVERIFIED; no statement about workflow health');
  }
  if (snapshot.pull_requests) {
    lines.push('- PR receipt (UTC): ' + safeMarkdownText(snapshot.pull_requests.received_at_utc),
      '- Inspected open PRs: ' + snapshot.pull_requests.inspected_prs +
      (snapshot.pull_requests.more_open_prs ? '; more open PRs may exist' : '; no additional open PRs indicated by sampled list'));
  } else {
    lines.push('- Pull requests: UNAVAILABLE / UNVERIFIED; no statement about merge readiness');
  }
  lines.push('', '## Suggested investigations — up to five', '');
  if (!suggestions.length) {
    lines.push('No triage signals were found in the inspected records. This is **not** a clean-CI, no-risk or merge-ready verdict.', '');
  }
  for (const [index, item] of suggestions.entries()) {
    const expected = item.sourceType === 'pull_request'
      ? sourceRoot + '/pull/' + Number(item.key.slice(3))
      : sourceRoot + '/actions/runs/' + Number(item.key.slice(4));
    if (item.url !== expected || !['high', 'medium', 'info'].includes(item.severity)) {
      throw new Error('Invalid investigation source identity.');
    }
    lines.push(
      String(index + 1) + '. **' + item.severity.toUpperCase() + ' / TRIAGE:** ' + safeMarkdownText(item.title),
      '   - Source: [' + safeMarkdownText(item.sourceLabel) + '](' + expected + ')',
      '   - Reported signal: ' + safeMarkdownText(item.reportedSignal),
      '   - Reason for priority: ' + safeMarkdownText(item.severityReason, 650),
      '   - Next manual verification: ' + safeMarkdownText(item.nextStep, 650),
      '',
    );
  }
  lines.push(
    '## Checks before any engineering action',
    '',
    '1. Reopen the original GitHub URL and verify current state, exact commit SHA, logs and review history.',
    '2. Check uninspected runs and pull requests; these samples are never a complete compliance or security audit.',
    '3. Confirm required branch protections, independent test results and release authority outside this handoff.',
    '',
    '**Action state:** No GitHub writes, retries, deployments, new API GETs, telemetry or private credentials were used to generate this file.',
    '',
  );
  const filename = createSampleFilename(snapshot.repository, snapshot.exported_at_utc, 'json')
    .replace(/\.json$/, '-investigation-handoff.md');
  return { filename, markdown: lines.join('\n') };
}