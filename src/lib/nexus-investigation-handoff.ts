import type { SampleExportInput } from './nexus-public-sample-export.ts';
import { createPublicSampleExport, createSampleFilename } from './nexus-public-sample-export.ts';
import { recommendInvestigations } from './nexus-recommendations.ts';
import { assessRepositoryRiskPosture } from './nexus-risk-posture.ts';
import { analyzeWorkflowRecurrence, describeRecurrenceSignal, RECURRENCE_SCOPE_NOTE } from './nexus-workflow-recurrence.ts';
import { analyzeChangeImpact, changeImpactMarkdownLines, hasChangeImpact } from './nexus-change-impact.ts';

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
  const posture = assessRepositoryRiskPosture({
    repository: input.repository,
    actions: input.actions, pulls: input.prs,
    actionsReceivedAt: input.actionsReceivedAt,
    prsReceivedAt: input.prsReceivedAt,
    asOf: new Date(input.exportedAt),
  });
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
  lines.push(
    '', '## Source-bounded assessment', '',
    '- Assessment: ' + safeMarkdownText(posture.headline),
    '- State: ' + posture.state + '; release authorized: no',
    '- Actions receipt: ' + posture.workflow.freshness +
      '; ' + posture.workflow.failed + ' observed failed out of ' + posture.workflow.inspected + ' inspected',
    '- Workflow runs not inspected: ' + posture.workflow.uninspected +
      (posture.workflow.freshness === 'unverified' ? ' (unknown; source unverified)' : ''),
    '- PR receipt: ' + posture.pullRequests.freshness +
      '; ' + posture.pullRequests.conflicts + ' conflict(s), ' +
      posture.pullRequests.reviewStates + ' restricted/behind/unstable, ' +
      posture.pullRequests.unknown + ' unknown out of ' + posture.pullRequests.inspected + ' inspected',
    '- Coverage: ' + posture.coverage,
    '- Limitations: ' + posture.evidenceLimitations.map(value => safeMarkdownText(value)).join('; '),
    '',
    '## Suggested investigations — up to five', '',
  );
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
  const recurrences = snapshot.actions ? analyzeWorkflowRecurrence(snapshot.actions.records) : [];
  if (recurrences.length) {
    lines.push('## Repeated failure signals (sample-bound)', '');
    for (const row of recurrences) {
      lines.push('- ' + safeMarkdownText(row.workflow) + ': ' + row.confirmed_failures + ' confirmed failures in ' +
        row.decisive_runs + ' decisive runs (' + row.ignored_runs + ' ignored: cancelled, skipped, neutral or not completed); ' +
        describeRecurrenceSignal(row.signal) + '. [Latest failed run](' + row.latest_failure_url + '), ' +
        safeMarkdownText(row.latest_failure_created_at) + '.');
    }
    lines.push('', '_' + safeMarkdownText(RECURRENCE_SCOPE_NOTE, 400) + '_', '');
  }
  const impact = snapshot.actions
    ? analyzeChangeImpact(snapshot.repository, snapshot.actions.records, snapshot.pull_requests?.records ?? [])
    : null;
  if (impact && hasChangeImpact(impact)) {
    lines.push('## Change impact signals (sample-bound)', '', ...changeImpactMarkdownLines(impact, safeMarkdownText), '');
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