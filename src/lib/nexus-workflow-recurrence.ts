import { isConfirmedWorkflowFailure } from './github-public-actions.ts';

/**
 * Deterministic, sample-bound repeated-failure signals for one already verified
 * workflow sample (at most 10 recent runs). This is NOT a flake rate, a root
 * cause, a risk score or permission to retry/merge/deploy: it only counts
 * confirmed failures of the same workflow name inside the rows it is given.
 *
 * Only completed runs with a decisive conclusion take part:
 *   - decisive failure: failure | timed_out | startup_failure
 *   - decisive success: success
 * cancelled / skipped / neutral / action_required / stale, and runs that are not
 * completed, are counted as `ignored_runs` and never extend or break a streak.
 */
export type RecurrenceRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
};

export type RecurrenceSignal = 'ongoing_failure_streak' | 'repeated_failure_recovered' | 'repeated_failure_mixed';

export type WorkflowRecurrence = {
  workflow: string;
  sampled_runs: number;
  decisive_runs: number;
  ignored_runs: number;
  confirmed_failures: number;
  /** Consecutive decisive failures counted from the most recent decisive run. */
  latest_failure_streak: number;
  latest_decisive_outcome: 'failure' | 'success';
  signal: RecurrenceSignal;
  latest_failure_url: string;
  latest_failure_created_at: string;
  earliest_failure_created_at: string;
};

/** A workflow needs at least this many confirmed failures in the sample to be reported. */
export const MIN_REPEATED_FAILURES = 2;
export const RECURRENCE_SAMPLE_LIMIT = 10;
export const RECURRENCE_SCOPE_NOTE =
  'Counts confirmed failures per workflow name only inside the exported sample (at most 10 recent runs). ' +
  'It is not a failure rate, root cause, flake diagnosis or merge/retry approval; older runs are not inspected.';

const time = (value: string): number => Date.parse(value);

/** Newest first; equal timestamps fall back to the larger run id so the order is stable. */
function newestFirst(a: RecurrenceRun, b: RecurrenceRun): number {
  return time(b.created_at) - time(a.created_at) || b.id - a.id;
}

export function analyzeWorkflowRecurrence(records: readonly RecurrenceRun[]): WorkflowRecurrence[] {
  if (!Array.isArray(records)) throw new Error('Workflow records must be an array.');
  if (records.length > RECURRENCE_SAMPLE_LIMIT) throw new Error('Workflow sample exceeds the bounded limit.');
  const groups = new Map<string, RecurrenceRun[]>();
  for (const run of records) {
    if (!run || typeof run.name !== 'string' || !Number.isSafeInteger(run.id) ||
        !Number.isFinite(time(run.created_at)) || typeof run.html_url !== 'string') {
      throw new Error('Invalid workflow record.');
    }
    const key = run.name.trim() || '(unnamed workflow)';
    const list = groups.get(key);
    if (list) list.push(run); else groups.set(key, [run]);
  }

  const rows: WorkflowRecurrence[] = [];
  for (const [workflow, runs] of groups) {
    const ordered = [...runs].sort(newestFirst);
    const decisive = ordered.filter(run => run.status === 'completed' &&
      (isConfirmedWorkflowFailure(run.conclusion) || run.conclusion === 'success'));
    const failures = decisive.filter(run => isConfirmedWorkflowFailure(run.conclusion));
    if (failures.length < MIN_REPEATED_FAILURES) continue;

    let streak = 0;
    for (const run of decisive) {
      if (!isConfirmedWorkflowFailure(run.conclusion)) break;
      streak += 1;
    }
    const latestFailed = isConfirmedWorkflowFailure(decisive[0].conclusion);
    const signal: RecurrenceSignal = latestFailed && streak >= MIN_REPEATED_FAILURES
      ? 'ongoing_failure_streak'
      : latestFailed ? 'repeated_failure_mixed' : 'repeated_failure_recovered';
    const newestFailure = failures[0];
    const oldestFailure = failures[failures.length - 1];
    rows.push({
      workflow,
      sampled_runs: ordered.length,
      decisive_runs: decisive.length,
      ignored_runs: ordered.length - decisive.length,
      confirmed_failures: failures.length,
      latest_failure_streak: streak,
      latest_decisive_outcome: latestFailed ? 'failure' : 'success',
      signal,
      latest_failure_url: newestFailure.html_url,
      latest_failure_created_at: newestFailure.created_at,
      earliest_failure_created_at: oldestFailure.created_at,
    });
  }

  const rank: Record<RecurrenceSignal, number> = {
    ongoing_failure_streak: 0, repeated_failure_mixed: 1, repeated_failure_recovered: 2,
  };
  return rows.sort((a, b) => rank[a.signal] - rank[b.signal] ||
    b.confirmed_failures - a.confirmed_failures || a.workflow.localeCompare(b.workflow, 'en'));
}

export function describeRecurrenceSignal(signal: RecurrenceSignal): string {
  switch (signal) {
    case 'ongoing_failure_streak': return 'the most recent decisive runs all failed';
    case 'repeated_failure_mixed': return 'failed repeatedly; the latest decisive run failed but earlier ones passed';
    case 'repeated_failure_recovered': return 'failed repeatedly; the latest decisive run succeeded';
  }
}
