// Opt-in, anonymous GitHub Actions failed-run job/step evidence for JARVIS.
// Reuses the already-tested F-04 public workflow module; no logs, retries or CI writes.
import { validateCommitTarget } from './nexus-commit-checks.mjs';
import { loadPublicWorkflowRunEvidence } from './github-public-workflow-evidence.ts';
import { isPublicRunEvidence, parsePublicRunId } from './nexus-workflow-run-evidence.ts';

export const WORKFLOW_STEPS_SCHEMA = 'nexus.devops.workflow-steps/v1';
const MAX_BYTES = 900_000;
const SECRET = /gh[pousr]_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{40,}|sk-(?:proj-)?[a-zA-Z0-9_-]{32,}|\b(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*\S+|-----BEGIN [A-Z ]*PRIVATE KEY-----/i;
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069]/g;

function scrub(value, limit = 160) {
  if (typeof value !== 'string') return '';
  if (SECRET.test(value)) return '[redacted: possible credential]';
  return value.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

export function validateWorkflowTarget(repository, sha, runId) {
  validateCommitTarget(repository, sha);
  const id = typeof runId === 'number' && Number.isSafeInteger(runId) && runId > 0
    ? runId : parsePublicRunId(runId);
  return { repository, sha, runId: id };
}

/** Bounded, nonredirecting GitHub-only GET. No token or bearer header is forwarded. */
async function boundedGitHubFetch(url, options, transport, target, identity) {
  const requested = new URL(url);
  if (requested.protocol !== 'https:' || requested.hostname !== 'api.github.com' ||
      requested.username || requested.password || requested.port ||
      !/^\/repos\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/actions\/runs\/[0-9]+(?:\/attempts\/[0-9]+\/jobs)?$/.test(requested.pathname)) {
    throw new Error('Unexpected GitHub API endpoint.');
  }
  const response = await transport(url, {
    ...options,
    method: 'GET',
    redirect: 'error',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'nexus-jarvis-workflow-steps',
    },
  });
  if (!response.ok) return {
    ok: false, status: response.status, headers: response.headers,
    json: async () => ({}),
  };
  if (!/application\/json/i.test(response.headers?.get('content-type') ?? '') ||
      Number(response.headers?.get('content-length')) > MAX_BYTES || !response.body) {
    throw new Error('Invalid upstream response type or size.');
  }
  return {
    ok: true,
    status: response.status,
    headers: response.headers,
    json: async () => {
      const reader = response.body.getReader();
      let size = 0;
      const chunks = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          throw new Error('Upstream response exceeded limit.');
        }
        chunks.push(value);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (requested.pathname.endsWith('/actions/runs/' + target.runId) &&
          (typeof data?.head_sha !== 'string' || data.head_sha.toLowerCase() !== target.sha)) {
        identity.mismatch = true;
        throw new Error('Commit identity mismatch.');
      }
      return data;
    },
  };
}

/** Data returned is an observed failed-run sample, never a verified root cause. */
export async function collectWorkflowSteps({
  repository, sha, runId, transport = fetch,
  loader = loadPublicWorkflowRunEvidence, now = () => new Date(),
}) {
  const target = validateWorkflowTarget(repository, sha, runId);
  let retrieved;
  const identity = { mismatch: false };
  try {
    retrieved = await loader(repository, target.runId,
      (url, options) => boundedGitHubFetch(url, options, transport, target, identity));
  } catch {
    return { ok: false, state: identity.mismatch ? 'identity_mismatch' : 'unavailable' };
  }
  if (retrieved?.status !== 200 ||
      !isPublicRunEvidence(retrieved.body, repository, target.runId)) {
    return { ok: false, state: identity.mismatch ? 'identity_mismatch' :
      retrieved?.status === 429 ? 'rate_limited' : 'unavailable' };
  }
  const evidence = retrieved.body;
  if (evidence.head_sha.toLowerCase() !== sha) {
    return { ok: false, state: 'identity_mismatch' };
  }
  const jobs = evidence.jobs.map(job => ({
    id: job.id,
    name: scrub(job.name),
    status: scrub(job.status, 60),
    conclusion: job.conclusion === null ? null : scrub(job.conclusion, 60),
    additional_steps_not_shown: job.additional_steps_not_shown,
    steps: job.steps.map(step => ({
      number: step.number,
      name: scrub(step.name),
      status: scrub(step.status, 60),
      conclusion: step.conclusion === null ? null : scrub(step.conclusion, 60),
    })),
  }));
  return {
    ok: true, state: 'verified', schema: WORKFLOW_STEPS_SCHEMA,
    generated_at_utc: now().toISOString(), repository, commit_sha: sha,
    workflow_run_id: target.runId,
    run_attempt: evidence.run_attempt,
    run_conclusion: evidence.conclusion,
    access: { mode: 'read_only', write_actions: [], paid_api_used: false, authentication_used: false },
    coverage: 'github_actions_failed_run_jobs_only',
    total_jobs: evidence.total_jobs,
    sampled_jobs: jobs.length,
    truncated: {
      jobs: evidence.total_jobs > jobs.length,
      steps: jobs.some(job => job.additional_steps_not_shown),
    },
    jobs,
    source_url: 'https://github.com/' + repository + '/actions/runs/' + target.runId,
    limitations: [
      'Only failed GitHub Actions runs are inspectable; not CircleCI/Vercel native logs.',
      'Up to 20 jobs and 10 steps per job from one exact run attempt are sampled.',
      'Job or step conclusions suggest where to inspect; no raw logs or root cause confirmed.',
    ],
  };
}
