import { isConfirmedWorkflowFailure, isHeadBranch, isHeadSha, parsePublicRepository } from './github-public-actions.ts';

/**
 * Deterministic, sample-bound change-impact signals for one already verified workflow
 * sample (at most 10 recent runs). It points at WHERE decisive outcomes changed inside
 * the sample and at the commits on either side; it never says which change caused a
 * failure, never scores risk and never approves a retry, merge or deploy.
 *
 * Two signals, both per workflow name and only from runs that carry commit data:
 *   - failure_window: on one branch the newest decisive run failed, the failures run
 *     back to an earlier decisive success on a DIFFERENT commit. The two commits are
 *     the edges of the window, with a GitHub compare link between them.
 *   - same_commit_conflict: one workflow both failed and succeeded on the SAME commit,
 *     so that outcome did not depend on the code change (rerun, flaky step, environment).
 *
 * Only completed runs with a decisive conclusion take part (failure | timed_out |
 * startup_failure, or success). cancelled / skipped / neutral / action_required / stale
 * and unfinished runs, and runs without a head commit, are never guessed about.
 */
export type ChangeImpactRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
  head_sha?: string;
  head_branch?: string;
};

export type ChangeImpactKind = 'failure_window' | 'same_commit_conflict';

export type ChangeImpact = {
  kind: ChangeImpactKind;
  workflow: string;
  head_branch: string | null;
  /** Commit of the earliest failure in the window (or the shared commit of a conflict). */
  failing_sha: string;
  /** Commit of the last decisive success before the window; equals failing_sha for a conflict. */
  passing_sha: string;
  failing_run_url: string;
  passing_run_url: string;
  /** Only for failure_window: https://github.com/<repo>/compare/<passing>...<failing>. */
  compare_url: string | null;
  /** Failed runs inside the window / on the shared commit. */
  failing_runs: number;
};

export type ChangeImpactResult = {
  signals: ChangeImpact[];
  sampled_runs: number;
  runs_with_commit_data: number;
};

export const CHANGE_IMPACT_SAMPLE_LIMIT = 10;
export const MAX_CHANGE_IMPACT_SIGNALS = 5;
export const CHANGE_IMPACT_SCOPE_NOTE =
  'Compares commits only between runs inside the exported sample (at most 10 recent runs) that carry commit data. ' +
  'A window shows where decisive outcomes changed in this sample, not which change caused the failure; ' +
  'a same-commit conflict points at a rerun or environment effect, not a diagnosis. ' +
  'It is not a root cause, risk score or retry/merge approval, and older runs are not inspected.';

const time = (value: string): number => Date.parse(value);

/** Newest first; equal timestamps fall back to the larger run id so the order is stable. */
function newestFirst(a: ChangeImpactRun, b: ChangeImpactRun): number {
  return time(b.created_at) - time(a.created_at) || b.id - a.id;
}

type Decisive = ChangeImpactRun & { head_sha: string };

function isDecisive(run: ChangeImpactRun): boolean {
  return run.status === 'completed' && (isConfirmedWorkflowFailure(run.conclusion) || run.conclusion === 'success');
}

export function analyzeChangeImpact(repository: string, records: readonly ChangeImpactRun[]): ChangeImpactResult {
  parsePublicRepository(repository);
  if (!Array.isArray(records)) throw new Error('Workflow records must be an array.');
  if (records.length > CHANGE_IMPACT_SAMPLE_LIMIT) throw new Error('Workflow sample exceeds the bounded limit.');
  const byWorkflow = new Map<string, Decisive[]>();
  let withCommit = 0;
  for (const run of records) {
    if (!run || typeof run.name !== 'string' || !Number.isSafeInteger(run.id) ||
        !Number.isFinite(time(run.created_at)) || typeof run.html_url !== 'string' ||
        (run.head_sha !== undefined && !isHeadSha(run.head_sha)) ||
        (run.head_branch !== undefined && !isHeadBranch(run.head_branch))) {
      throw new Error('Invalid workflow record.');
    }
    if (run.head_sha === undefined) continue;
    withCommit += 1;
    if (!isDecisive(run)) continue;
    const key = run.name.trim() || '(unnamed workflow)';
    const list = byWorkflow.get(key);
    const entry = run as Decisive;
    if (list) list.push(entry); else byWorkflow.set(key, [entry]);
  }

  const signals: ChangeImpact[] = [];
  const rank: Record<ChangeImpactKind, number> = { failure_window: 0, same_commit_conflict: 1 };
  for (const [workflow, runs] of byWorkflow) {
    const ordered = [...runs].sort(newestFirst);

    // Same commit, both outcomes.
    const bySha = new Map<string, Decisive[]>();
    for (const run of ordered) {
      const list = bySha.get(run.head_sha);
      if (list) list.push(run); else bySha.set(run.head_sha, [run]);
    }
    const conflictShas = new Set<string>();
    for (const [sha, shaRuns] of bySha) {
      const failures = shaRuns.filter(run => isConfirmedWorkflowFailure(run.conclusion));
      const success = shaRuns.find(run => run.conclusion === 'success');
      if (!failures.length || !success) continue;
      conflictShas.add(sha);
      signals.push({
        kind: 'same_commit_conflict', workflow, head_branch: failures[0].head_branch ?? null,
        failing_sha: sha, passing_sha: sha,
        failing_run_url: failures[0].html_url, passing_run_url: success.html_url,
        compare_url: null, failing_runs: failures.length,
      });
    }

    // Failure window per branch (runs without a branch cannot be compared).
    const byBranch = new Map<string, Decisive[]>();
    for (const run of ordered) {
      if (run.head_branch === undefined) continue;
      const list = byBranch.get(run.head_branch);
      if (list) list.push(run); else byBranch.set(run.head_branch, [run]);
    }
    for (const [branch, branchRuns] of byBranch) {
      if (!isConfirmedWorkflowFailure(branchRuns[0].conclusion)) continue;
      let end = 0;
      while (end < branchRuns.length && isConfirmedWorkflowFailure(branchRuns[end].conclusion)) end += 1;
      const before = branchRuns[end];
      if (!before || before.conclusion !== 'success') continue;
      const streak = branchRuns.slice(0, end);
      const earliest = streak[streak.length - 1];
      if (before.head_sha === earliest.head_sha || streak.some(run => run.head_sha === before.head_sha)) continue;
      signals.push({
        kind: 'failure_window', workflow, head_branch: branch,
        failing_sha: earliest.head_sha, passing_sha: before.head_sha,
        failing_run_url: earliest.html_url, passing_run_url: before.html_url,
        compare_url: 'https://github.com/' + repository + '/compare/' + before.head_sha + '...' + earliest.head_sha,
        failing_runs: streak.length,
      });
    }
  }

  signals.sort((a, b) => rank[a.kind] - rank[b.kind] || b.failing_runs - a.failing_runs ||
    a.workflow.localeCompare(b.workflow, 'en') || a.failing_sha.localeCompare(b.failing_sha, 'en'));
  return {
    signals: signals.slice(0, MAX_CHANGE_IMPACT_SIGNALS),
    sampled_runs: records.length,
    runs_with_commit_data: withCommit,
  };
}

export const shortSha = (sha: string): string => sha.slice(0, 7);

export function describeChangeImpact(signal: ChangeImpact): string {
  if (signal.kind === 'same_commit_conflict') {
    return 'both failed and succeeded on commit ' + shortSha(signal.failing_sha) +
      ', so that outcome did not depend on the code change';
  }
  return 'failures begin at commit ' + shortSha(signal.failing_sha) +
    '; the last decisive success before them on this branch was commit ' + shortSha(signal.passing_sha);
}
