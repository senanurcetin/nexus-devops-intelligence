export type PublicWorkflowRun = {
  id: number;
  name: string;
  event: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
  /** Commit the run executed; present only when GitHub supplied a well-formed value. */
  head_sha?: string;
  /** Branch the run executed for; present only when GitHub supplied a well-formed value. */
  head_branch?: string;
};

export type PublicActionsSummary = {
  repository: string;
  total_matching_runs: number;
  inspected_runs: number;
  successful_runs: number;
  failed_runs: number;
  pending_runs: number;
  other_outcome_runs: number;
  runs: PublicWorkflowRun[];
  scope_note: string;
};

export function parsePublicRepository(value: unknown): [string, string] {
  if (typeof value !== 'string' || value.length > 200 ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error('Use a public GitHub repository in owner/name format.');
  }
  const parts = value.split('/') as [string, string];
  if (parts.some(part => part === '.' || part === '..' || part.length > 100)) {
    throw new Error('Use a valid public repository.');
  }
  return parts;
}

/** GitHub conclusions that definitively indicate a failed workflow run. */
export function isConfirmedWorkflowFailure(conclusion: string | null): boolean {
  return conclusion === 'failure' || conclusion === 'timed_out' ||
    conclusion === 'startup_failure';
}

/** A full git commit id (SHA-1; SHA-256 object names are accepted too). Lowercase hex only. */
export function isHeadSha(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{40}([0-9a-f]{24})?$/.test(value);
}

/** A branch name from GitHub: non-empty, bounded, no control characters. Treated as untrusted text. */
export function isHeadBranch(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 255 &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

/** Commit data is optional (null/absent is fine); when it is present it must be well formed. */
export function validHeadFields(run: { head_sha?: unknown; head_branch?: unknown }): boolean {
  return (run.head_sha === undefined || run.head_sha === null || isHeadSha(run.head_sha)) &&
    (run.head_branch === undefined || run.head_branch === null || isHeadBranch(run.head_branch));
}

const IN_PROGRESS_STATUSES = new Set(['queued', 'in_progress', 'requested', 'waiting', 'pending']);

export function summarizePublicActions(repository: string, payload: unknown): PublicActionsSummary {
  parsePublicRepository(repository);
  if (!payload || typeof payload !== 'object') {
    throw new Error('Unexpected GitHub API response.');
  }
  const data = payload as { total_count?: unknown; workflow_runs?: unknown };
  if (typeof data.total_count !== 'number' || !Number.isSafeInteger(data.total_count) || data.total_count < 0 ||
      !Array.isArray(data.workflow_runs)) {
    throw new Error('Unexpected GitHub API response.');
  }
  const sampled = data.workflow_runs.slice(0, 10);
  if (data.total_count < sampled.length) {
    throw new Error('GitHub returned inconsistent workflow counts.');
  }
  const runIds = new Set<number>();
  const runs: PublicWorkflowRun[] = sampled.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid workflow run.');
    const run = item as Partial<PublicWorkflowRun>;
    if (typeof run.id !== 'number' || !Number.isSafeInteger(run.id) || run.id < 1 ||
        runIds.has(run.id) || typeof run.name !== 'string' ||
        typeof run.status !== 'string' || typeof run.event !== 'string' ||
        (run.conclusion !== null && typeof run.conclusion !== 'string') ||
        typeof run.created_at !== 'string' || !Number.isFinite(Date.parse(run.created_at)) ||
        typeof run.html_url !== 'string' || !validHeadFields(run)) {
      throw new Error('Invalid workflow run.');
    }
    runIds.add(run.id);
    const expected = 'https://github.com/' + repository + '/actions/runs/' + run.id;
    if (run.html_url !== expected) throw new Error('Unexpected run URL.');
    return {
      id: run.id as number,
      name: run.name,
      status: run.status,
      event: run.event,
      conclusion: run.conclusion,
      created_at: run.created_at,
      html_url: expected,
      ...(isHeadSha(run.head_sha) ? { head_sha: run.head_sha } : {}),
      ...(isHeadBranch(run.head_branch) ? { head_branch: run.head_branch } : {}),
    };
  });
  const failed = runs.filter(r => r.status === 'completed' && isConfirmedWorkflowFailure(r.conclusion)).length;
  const successful = runs.filter(r => r.status === 'completed' && r.conclusion === 'success').length;
  const pending = runs.filter(r => IN_PROGRESS_STATUSES.has(r.status)).length;
  const otherCompleted = runs.length - failed - successful - pending;
  return {
    repository,
    total_matching_runs: data.total_count as number,
    inspected_runs: runs.length,
    successful_runs: successful,
    failed_runs: failed,
    pending_runs: pending,
    other_outcome_runs: otherCompleted,
    runs,
    scope_note: 'Public workflows only. Sample of up to 10 runs; completed cancelled/skipped/neutral runs are not pending or failures. not billed minutes, monthly costs or a full historical audit.',
  };
}
