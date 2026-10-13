import type { PublicPullRequest, PublicPullSummary, PullAttention } from './nexus-public-prs.ts';

/** Source-derived classification, not a merge permission, prediction or audit. */
export type PullBucket = 'conflict' | 'restrictions' | 'unverified' | 'clean' | 'draft';
export type PullFilter = PullBucket | 'all';

export const pullBuckets: readonly {
  key: PullBucket;
  label: string;
  shortLabel: string;
}[] = [
  { key: 'conflict', label: 'Reported conflicts', shortLabel: 'Conflicts' },
  { key: 'restrictions', label: 'Merge restrictions / checks', shortLabel: 'Restrictions' },
  { key: 'unverified', label: 'Not verified', shortLabel: 'Unverified' },
  { key: 'clean', label: 'Clean (GitHub-reported)', shortLabel: 'Clean' },
  { key: 'draft', label: 'Drafts', shortLabel: 'Drafts' },
] as const;

const restrictionStates = new Set<PullAttention>(['blocked', 'behind', 'unstable']);

export function pullBucket(pr: PublicPullRequest): PullBucket {
  if (pr.attention === 'conflict') return 'conflict';
  if (restrictionStates.has(pr.attention)) return 'restrictions';
  if (pr.attention === 'unknown') return 'unverified';
  if (pr.attention === 'clear') return 'clean';
  return 'draft';
}

/** A PR belongs to exactly one group, using only verified response fields. */
export function pullBucketCount(summary: PublicPullSummary, bucket: PullBucket): number {
  return summary.pull_requests.filter(pr => pullBucket(pr) === bucket).length;
}

export function filteredPublicPulls(
  summary: PublicPullSummary | null,
  filter: PullFilter,
): PublicPullRequest[] {
  if (!summary) return [];
  return filter === 'all'
    ? summary.pull_requests
    : summary.pull_requests.filter(pr => pullBucket(pr) === filter);
}
