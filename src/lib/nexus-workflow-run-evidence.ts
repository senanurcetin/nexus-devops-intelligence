import { isConfirmedWorkflowFailure, parsePublicRepository } from './github-public-actions.ts';

export const JOB_SAMPLE_LIMIT = 20;
export const STEP_SAMPLE_LIMIT = 10;

export type PublicRunStep = {
  number: number;
  name: string;
  status: string;
  conclusion: string | null;
};
export type PublicRunJob = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  steps: PublicRunStep[];
  additional_steps_not_shown: boolean;
};
export type PublicRunEvidence = {
  repository: string;
  id: number;
  html_url: string;
  head_sha: string;
  run_attempt: number;
  status: 'completed';
  conclusion: 'failure' | 'timed_out' | 'startup_failure';
  total_jobs: number;
  inspected_jobs: number;
  jobs: PublicRunJob[];
  scope_note: string;
};

const asObject = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? v as Record<string, unknown> : null;
const positive = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 1;
const nonnegative = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const string = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;
const outcome = (v: unknown): v is string | null =>
  v === null || string(v, 70);

export function parsePublicRunId(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,15}$/.test(value)) {
    throw new Error('Invalid workflow run identifier.');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error('Invalid workflow run identifier.');
  return parsed;
}

/** Guard a run identity *before* any second, job-list API GET. */
export function validateFailedRunIdentity(repository: string, id: number, value: unknown): {
  head_sha: string; run_attempt: number; conclusion: PublicRunEvidence['conclusion'];
} {
  parsePublicRepository(repository);
  parsePublicRunId(String(id));
  const obj = asObject(value);
  if (!obj || obj.id !== id ||
      obj.html_url !== 'https://github.com/' + repository + '/actions/runs/' + id ||
      obj.status !== 'completed' || !isConfirmedWorkflowFailure(
        typeof obj.conclusion === 'string' ? obj.conclusion : null,
      ) ||
      !string(obj.head_sha, 40) || !/^[a-fA-F0-9]{40}$/.test(obj.head_sha) ||
      !positive(obj.run_attempt) || obj.run_attempt > 1000) {
    throw new Error('Invalid or changed workflow run state.');
  }
  return {
    head_sha: obj.head_sha as string,
    run_attempt: obj.run_attempt as number,
    conclusion: obj.conclusion as PublicRunEvidence['conclusion'],
  };
}

/**
 * Read-only, bounded evidence of an explicitly selected failed run attempt.
 * Display of failed step names is NOT a diagnosis and excludes raw logs.
 */
export function summarizePublicRunEvidence(
  repository: string, id: number, runData: unknown, jobsData: unknown,
): PublicRunEvidence {
  const run = validateFailedRunIdentity(repository, id, runData);
  const page = asObject(jobsData);
  if (!page || !nonnegative(page.total_count) || !Array.isArray(page.jobs) ||
      page.jobs.length > JOB_SAMPLE_LIMIT || page.total_count < page.jobs.length) {
    throw new Error('Unexpected GitHub workflow job page.');
  }
  const jobIds = new Set<number>();
  const jobs: PublicRunJob[] = page.jobs.map(raw => {
    const obj = asObject(raw);
    if (!obj || !positive(obj.id) || jobIds.has(obj.id) ||
        obj.run_id !== id ||
        (obj.run_attempt !== undefined && obj.run_attempt !== run.run_attempt) ||
        !string(obj.name, 200) || !string(obj.status, 70) ||
        !outcome(obj.conclusion) ||
        (obj.steps !== null && obj.steps !== undefined && !Array.isArray(obj.steps))) {
      throw new Error('Invalid GitHub workflow job.');
    }
    jobIds.add(obj.id);
    const inputSteps = Array.isArray(obj.steps) ? obj.steps : [];
    const stepIds = new Set<number>();
    const steps: PublicRunStep[] = inputSteps.slice(0, STEP_SAMPLE_LIMIT).map(rawStep => {
      const step = asObject(rawStep);
      if (!step || !positive(step.number) || stepIds.has(step.number) ||
          !string(step.name, 200) || !string(step.status, 70) ||
          !outcome(step.conclusion)) {
        throw new Error('Invalid GitHub workflow job step.');
      }
      stepIds.add(step.number);
      return { number: step.number, name: step.name as string,
        status: step.status as string, conclusion: step.conclusion as string | null };
    });
    return { id: obj.id as number, name: obj.name as string,
      status: obj.status as string, conclusion: obj.conclusion as string | null,
      steps, additional_steps_not_shown: inputSteps.length > STEP_SAMPLE_LIMIT };
  });
  return {
    repository, id,
    html_url: 'https://github.com/' + repository + '/actions/runs/' + id,
    head_sha: run.head_sha, run_attempt: run.run_attempt,
    status: 'completed', conclusion: run.conclusion,
    total_jobs: page.total_count as number, inspected_jobs: jobs.length, jobs,
    scope_note: 'A bounded read-only sample of up to 20 jobs and 10 steps per job from the selected failed workflow attempt. Job and step conclusions can narrow manual investigation; they do not prove root cause. GitHub source logs have not been downloaded.',
  };
}

/** Reject forged browser samples, including unrelated repo/run identity. */
export function isPublicRunEvidence(
  value: unknown, repository: string, id: number,
): value is PublicRunEvidence {
  try {
    if (!value || typeof value !== 'object') return false;
    const v = value as Partial<PublicRunEvidence>;
    if (v.repository !== repository || v.id !== id || v.status !== 'completed' ||
        !isConfirmedWorkflowFailure(v.conclusion ?? null) ||
        v.html_url !== 'https://github.com/' + repository + '/actions/runs/' + id ||
        !string(v.head_sha, 40) || !/^[a-fA-F0-9]{40}$/.test(v.head_sha) ||
        !positive(v.run_attempt) || v.run_attempt > 1000 ||
        !nonnegative(v.total_jobs) || !nonnegative(v.inspected_jobs) ||
        v.inspected_jobs > JOB_SAMPLE_LIMIT || v.total_jobs < v.inspected_jobs ||
        !Array.isArray(v.jobs) || v.jobs.length !== v.inspected_jobs ||
        !string(v.scope_note, 700)) return false;
    const seen = new Set<number>();
    for (const job of v.jobs) {
      if (!positive(job.id) || seen.has(job.id) || !string(job.name, 200) ||
          !string(job.status, 70) || !outcome(job.conclusion) ||
          !Array.isArray(job.steps) || job.steps.length > STEP_SAMPLE_LIMIT ||
          typeof job.additional_steps_not_shown !== 'boolean') return false;
      seen.add(job.id);
      const steps = new Set<number>();
      for (const step of job.steps) {
        if (!positive(step.number) || steps.has(step.number) || !string(step.name, 200) ||
            !string(step.status, 70) || !outcome(step.conclusion)) return false;
        steps.add(step.number);
      }
    }
    return true;
  } catch { return false; }
}
