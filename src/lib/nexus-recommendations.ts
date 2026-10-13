import { isConfirmedWorkflowFailure, type PublicActionsSummary } from './github-public-actions.ts';
import type { PublicPullSummary, PullAttention } from './nexus-public-prs.ts';

/**
 * One source-backed investigation. Severity is a deterministic triage label,
 * NOT a diagnosis, risk score, check status or permission to merge.
 */
export type NexusRecommendation = {
  key: string;
  severity: 'high' | 'medium' | 'info';
  title: string;
  explanation: string;
  url: string;
  sourceType: 'pull_request' | 'workflow_run';
  sourceLabel: string;
  reportedSignal: string;
  severityReason: string;
  nextStep: string;
};

const severityOrder = { high: 0, medium: 1, info: 2 } as const;

type PrInvestigation = {
  severity: NexusRecommendation['severity'];
  title: string;
  signal: string;
  severityReason: string;
  nextStep: string;
};

const prInvestigation: Partial<Record<PullAttention, PrInvestigation>> = {
  conflict: {
    severity: 'high',
    title: 'Resolve confirmed merge conflict',
    signal: 'GitHub reports conflicting mergeability',
    severityReason: 'A GitHub-reported merge conflict directly obstructs a clean merge.',
    nextStep: 'Open the PR to inspect the conflicting files and base branch. Resolve conflicts in GitHub or locally after review.',
  },
  blocked: {
    severity: 'medium',
    title: 'Review merge restrictions',
    signal: 'GitHub reports merge state: blocked',
    severityReason: 'A reported merge restriction needs review; the specific missing approval or check has not been fetched.',
    nextStep: 'Open the PR and inspect GitHub branch protection, check runs and requested reviews before taking action.',
  },
  unstable: {
    severity: 'medium',
    title: 'Inspect unstable PR checks',
    signal: 'GitHub reports merge state: unstable',
    severityReason: 'GitHub reported an unstable merge state, but this sample does not identify a specific failing check.',
    nextStep: 'Open the PR checks tab and review the original check conclusions before diagnosing a failure.',
  },
  behind: {
    severity: 'medium',
    title: 'Check whether the branch needs updating',
    signal: 'GitHub reports merge state: behind',
    severityReason: 'The branch appears behind its base; this alone does not establish a failed CI run.',
    nextStep: 'Open the PR and compare its base branch status before choosing whether an update is needed.',
  },
  unknown: {
    severity: 'info',
    title: 'Verify pending PR merge status',
    signal: 'Merge status not verified in this sample',
    severityReason: 'GitHub has not supplied a confirmed merge state; no actual blocker can be inferred.',
    nextStep: 'Open the PR in GitHub and review the latest merge state, checks and discussion.',
  },
};

/** At most five deterministic suggestions from source-verified inspected records. */
export function recommendInvestigations(
  actions: PublicActionsSummary | null,
  pulls: PublicPullSummary | null,
): NexusRecommendation[] {
  const suggestions: NexusRecommendation[] = [];
  for (const pr of pulls?.pull_requests ?? []) {
    const meta = prInvestigation[pr.attention];
    if (!meta || !pulls ||
        pr.html_url !== 'https://github.com/' + pulls.repository + '/pull/' + pr.number) continue;
    suggestions.push({
      key: 'pr-' + pr.number,
      severity: meta.severity,
      title: meta.title + ' · #' + pr.number,
      explanation: pr.explanation,
      url: pr.html_url,
      sourceType: 'pull_request',
      sourceLabel: 'PR #' + pr.number,
      reportedSignal: meta.signal,
      severityReason: meta.severityReason,
      nextStep: meta.nextStep,
    });
  }
  for (const run of actions?.runs ?? []) {
    if (!actions || !isConfirmedWorkflowFailure(run.conclusion) ||
        run.status !== 'completed' ||
        run.html_url !== 'https://github.com/' + actions.repository + '/actions/runs/' + run.id) continue;
    const failure = run.conclusion === 'timed_out' ? 'timed-out' :
      run.conclusion === 'startup_failure' ? 'startup-failed' : 'failed';
    suggestions.push({
      key: 'run-' + run.id,
      severity: 'high',
      title: 'Inspect ' + failure + ' workflow · ' + run.name,
      explanation: 'GitHub reports workflow conclusion "' + run.conclusion +
        '" for a ' + run.event + ' run; inspect its logs before diagnosing a cause.',
      url: run.html_url,
      sourceType: 'workflow_run',
      sourceLabel: 'Actions run #' + run.id,
      reportedSignal: 'GitHub conclusion: ' + run.conclusion,
      severityReason: 'A completed GitHub workflow has an explicitly reported unsuccessful conclusion; its underlying cause is not known.',
      nextStep: 'Open the original GitHub Actions run to review logs, affected jobs and any retry history before assigning a cause.',
    });
  }
  return suggestions
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 5);
}
