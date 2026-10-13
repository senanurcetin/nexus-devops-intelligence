import {
  isConfirmedWorkflowFailure,
  type PublicActionsSummary,
  type PublicWorkflowRun,
} from './github-public-actions.ts';

export type WorkflowOutcome = 'success' | 'failed' | 'pending' | 'other';
export type WorkflowFilter = 'all' | WorkflowOutcome;

const activeStatuses = new Set(['queued', 'in_progress', 'requested', 'waiting', 'pending']);

/** Match the server's evidence-based classification. Never turn cancelled into failure. */
export function workflowOutcome(run: PublicWorkflowRun): WorkflowOutcome {
  if (activeStatuses.has(run.status)) return 'pending';
  if (run.status === 'completed' && run.conclusion === 'success') return 'success';
  if (run.status === 'completed' && isConfirmedWorkflowFailure(run.conclusion)) return 'failed';
  return 'other';
}

export const workflowOutcomes: readonly {
  key: WorkflowOutcome;
  label: string;
  shortLabel: string;
}[] = [
  { key: 'success', label: 'Successful', shortLabel: 'Success' },
  { key: 'failed', label: 'Confirmed failures', shortLabel: 'Failed' },
  { key: 'pending', label: 'In progress', shortLabel: 'Pending' },
  { key: 'other', label: 'Other outcomes', shortLabel: 'Other' },
] as const;

export function workflowOutcomeCount(
  summary: PublicActionsSummary,
  outcome: WorkflowOutcome,
): number {
  switch (outcome) {
    case 'success': return summary.successful_runs;
    case 'failed': return summary.failed_runs;
    case 'pending': return summary.pending_runs;
    case 'other': return summary.other_outcome_runs;
  }
}

/** Derived entirely from the already loaded max-10 public Actions sample. */
export function filteredWorkflowRuns(
  summary: PublicActionsSummary | null,
  filter: WorkflowFilter,
): PublicWorkflowRun[] {
  if (!summary) return [];
  return filter === 'all'
    ? summary.runs
    : summary.runs.filter(run => workflowOutcome(run) === filter);
}
