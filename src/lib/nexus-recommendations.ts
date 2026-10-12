import type { PublicActionsSummary } from './github-public-actions.ts';
import type { PublicPullSummary, PullAttention } from './nexus-public-prs.ts';

/** Evidence-backed suggestions only: no speculative diagnosis or repo writes. */
export type NexusRecommendation = {
  key: string;
  severity: 'high' | 'medium' | 'info';
  title: string;
  explanation: string;
  url: string;
};

const severityOrder = { high: 0, medium: 1, info: 2 } as const;

const attentionSeverity: Partial<Record<PullAttention, NexusRecommendation['severity']>> = {
  conflict: 'high', blocked: 'medium', unstable: 'medium', behind: 'medium', unknown: 'info',
};

const attentionTitle: Partial<Record<PullAttention, string>> = {
  conflict: 'Resolve confirmed merge conflict',
  blocked: 'Review merge restrictions',
  unstable: 'Inspect unstable PR checks',
  behind: 'Check whether the branch needs updating',
  unknown: 'Verify pending PR merge status',
};

/** At most five deterministic suggestions about the *inspected sample* only. */
export function recommendInvestigations(
  actions: PublicActionsSummary | null,
  pulls: PublicPullSummary | null,
): NexusRecommendation[] {
  const suggestions: NexusRecommendation[] = [];
  for (const pr of pulls?.pull_requests ?? []) {
    const severity = attentionSeverity[pr.attention];
    if (!severity) continue;
    suggestions.push({
      key: `pr-${pr.number}`,
      severity,
      title: `${attentionTitle[pr.attention]} · #${pr.number}`,
      explanation: pr.explanation,
      url: pr.html_url,
    });
  }
  for (const run of actions?.runs ?? []) {
    if (run.conclusion !== 'failure') continue;
    suggestions.push({
      key: `run-${run.id}`,
      severity: 'high',
      title: `Inspect failed workflow · ${run.name}`,
      explanation: `GitHub reports a failed ${run.event} workflow run; inspect its logs before diagnosing a cause.`,
      url: run.html_url,
    });
  }
  return suggestions
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 5);
}
