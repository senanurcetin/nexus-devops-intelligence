import type { PublicActionsSummary } from './github-public-actions.ts';
import type { PublicPullSummary, PullAttention } from './nexus-public-prs.ts';

/**
 * Untrusted JSON still needs checking at the browser boundary even if the
 * server normally validates GitHub responses. Never display a sample for a
 * different selected repository, a broken metric, or a non-GitHub link.
 */
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;

const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const positiveInt = (value: unknown): value is number =>
  count(value) && value > 0;

const string = (value: unknown, max = 2000): value is string =>
  typeof value === 'string' && value.length <= max;

const timestamp = (value: unknown): value is string =>
  string(value, 100) && Number.isFinite(Date.parse(value));

const attentionStates = new Set<PullAttention>([
  'draft', 'conflict', 'blocked', 'behind', 'unstable', 'clear', 'unknown',
]);
const investigatedStates = new Set<PullAttention>([
  'conflict', 'blocked', 'behind', 'unstable', 'unknown',
]);

export function isPublicActionsSample(
  payload: unknown,
  repository: string,
): payload is PublicActionsSummary {
  const value = object(payload);
  if (!value || value.repository !== repository ||
      !count(value.total_matching_runs) || !count(value.inspected_runs) ||
      value.inspected_runs > 10 || value.total_matching_runs < value.inspected_runs ||
      !count(value.successful_runs) || !count(value.failed_runs) ||
      !count(value.pending_runs) || !count(value.other_outcome_runs) ||
      !string(value.scope_note, 1200) || !Array.isArray(value.runs) ||
      value.runs.length !== value.inspected_runs ||
      value.successful_runs + value.failed_runs + value.pending_runs +
      value.other_outcome_runs !== value.inspected_runs) {
    return false;
  }
  const ids = new Set<number>();
  for (const item of value.runs) {
    const run = object(item);
    if (!run || !positiveInt(run.id) || ids.has(run.id) ||
        !string(run.name) || !string(run.event) || !string(run.status) ||
        !(run.conclusion === null || string(run.conclusion)) ||
        !timestamp(run.created_at) ||
        run.html_url !== `https://github.com/${repository}/actions/runs/${run.id}`) {
      return false;
    }
    ids.add(run.id);
  }
  return true;
}

export function isPublicPullSample(
  payload: unknown,
  repository: string,
): payload is PublicPullSummary {
  const value = object(payload);
  if (!value || value.repository !== repository ||
      !count(value.inspected_prs) || value.inspected_prs > 5 ||
      typeof value.more_open_prs !== 'boolean' ||
      !count(value.conflicts) || !count(value.needs_attention) ||
      !count(value.unknown) || !string(value.scope_note, 1200) ||
      !Array.isArray(value.pull_requests) ||
      value.pull_requests.length !== value.inspected_prs) {
    return false;
  }
  let conflicts = 0;
  let unknown = 0;
  let needsAttention = 0;
  const ids = new Set<number>();
  for (const item of value.pull_requests) {
    const pr = object(item);
    if (!pr || !positiveInt(pr.number) || ids.has(pr.number) ||
        !string(pr.title, 300) || !string(pr.author, 100) ||
        !string(pr.explanation, 2000) || !timestamp(pr.updated_at) ||
        pr.html_url !== `https://github.com/${repository}/pull/${pr.number}` ||
        !attentionStates.has(pr.attention as PullAttention)) {
      return false;
    }
    ids.add(pr.number);
    if (pr.attention === 'conflict') conflicts++;
    if (pr.attention === 'unknown') unknown++;
    if (investigatedStates.has(pr.attention as PullAttention)) needsAttention++;
  }
  return value.conflicts === conflicts && value.unknown === unknown &&
    value.needs_attention === needsAttention;
}
