import { parsePublicRepository } from './github-public-actions.ts';

export type PublicCommitCheckItem = {
  kind: 'check_run' | 'commit_status';
  provider: string;
  name: string;
  outcome: 'failure' | 'pending' | 'success' | 'other';
  reported_status: string;
  reported_conclusion: string | null;
  source_url: string;
  inspection_hint: string;
};
export type PublicCommitChecks = {
  schema: 'nexus.devops.commit-checks/v1';
  generated_at_utc: string;
  repository: string;
  commit_sha: string;
  sources: { checks: SourceState; commit_statuses: SourceState };
  coverage: 'both_sources' | 'checks_only' | 'commit_statuses_only' | 'none';
  sampled_records: number;
  truncated: { checks: boolean; commit_statuses: boolean };
  counts: { failure: number; pending: number; success: number; other: number };
  observed_state: string;
  items: PublicCommitCheckItem[];
  limitations: string[];
};
type SourceState = 'verified' | 'rate_limited' | 'not_found' | 'unavailable' | 'invalid';
const SOURCE_STATES = ['verified', 'rate_limited', 'not_found', 'unavailable', 'invalid'];
const COVERAGE = ['both_sources', 'checks_only', 'commit_statuses_only', 'none'];
const OUTCOMES = ['failure', 'pending', 'success', 'other'];

const obj = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
const int = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const str = (v: unknown, max = 400): v is string => typeof v === 'string' && v.length <= max;

/** Reject cross-repository, cross-commit and untrusted payloads at the browser boundary. */
export function isPublicCommitChecks(
  value: unknown, repository: string, sha: string,
): value is PublicCommitChecks {
  try { parsePublicRepository(repository); } catch { return false; }
  const d = obj(value);
  const sources = obj(d?.sources), truncated = obj(d?.truncated), counts = obj(d?.counts);
  if (!d || !sources || !truncated || !counts ||
      d.schema !== 'nexus.devops.commit-checks/v1' ||
      d.repository !== repository || d.commit_sha !== sha.toLowerCase() ||
      !str(d.generated_at_utc, 40) || !str(d.observed_state, 60) ||
      !SOURCE_STATES.includes(sources.checks as string) ||
      !SOURCE_STATES.includes(sources.commit_statuses as string) ||
      !COVERAGE.includes(d.coverage as string) ||
      typeof truncated.checks !== 'boolean' || typeof truncated.commit_statuses !== 'boolean' ||
      !OUTCOMES.every(k => int(counts[k])) ||
      !int(d.sampled_records) || d.sampled_records > 200 ||
      !Array.isArray(d.items) || d.items.length !== d.sampled_records ||
      !Array.isArray(d.limitations) || d.limitations.length > 10 ||
      !d.limitations.every(l => str(l, 400))) return false;
  const url = 'https://github.com/' + repository + '/commit/' + d.commit_sha + '/checks';
  const tally: Record<string, number> = { failure: 0, pending: 0, success: 0, other: 0 };
  for (const raw of d.items) {
    const i = obj(raw);
    if (!i || (i.kind !== 'check_run' && i.kind !== 'commit_status') ||
        !str(i.provider, 40) || !str(i.name, 200) || !OUTCOMES.includes(i.outcome as string) ||
        !str(i.reported_status, 40) ||
        !(i.reported_conclusion === null || str(i.reported_conclusion, 40)) ||
        i.source_url !== url || !str(i.inspection_hint, 400)) return false;
    tally[i.outcome as string] += 1;
  }
  return OUTCOMES.every(k => tally[k] === counts[k]);
}
