import { isConfirmedWorkflowFailure, type PublicActionsSummary } from './github-public-actions.ts';
import type { PublicPullSummary } from './nexus-public-prs.ts';
import { isPublicActionsSample, isPublicPullSample } from './nexus-panel-validation.ts';

export type EvidenceFreshness = 'recent' | 'stale' | 'unverified';
export type RiskPostureState =
  | 'investigate_observed' | 'review_observed'
  | 'refresh_before_decision' | 'no_confirmed_signal' | 'await_evidence';

export type RiskPosture = {
  state: RiskPostureState;
  headline: string;
  repository: string;
  workflow: {
    freshness: EvidenceFreshness;
    inspected: number;
    uninspected: number;
    failed: number;
    truncated: boolean;
  };
  pullRequests: {
    freshness: EvidenceFreshness;
    inspected: number;
    conflicts: number;
    reviewStates: number;
    unknown: number;
    moreOpenMayExist: boolean;
  };
  coverage: 'both' | 'actions_only' | 'prs_only' | 'none';
  evidenceLimitations: string[];
  releaseAuthorized: false;
};

const THIRTY_MINUTES = 30 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;
const receiptFreshness = (value: string | null, now: Date): EvidenceFreshness => {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
      !Number.isFinite(now.valueOf())) return 'unverified';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value ||
      parsed - now.valueOf() > ONE_MINUTE) return 'unverified';
  return now.valueOf() - parsed > THIRTY_MINUTES ? 'stale' : 'recent';
};

/**
 * Evidence-bounded local posture, NOT a probabilistic risk score or CI verdict.
 * No fetch, background action, repository mutation, PR/run correlation, or
 * optimistic inference when data is missing, sampled or stale.
 */
export function assessRepositoryRiskPosture({
  repository, actions, pulls, actionsReceivedAt, prsReceivedAt, asOf,
}: {
  repository: string;
  actions: PublicActionsSummary | null;
  pulls: PublicPullSummary | null;
  actionsReceivedAt: string | null;
  prsReceivedAt: string | null;
  asOf: Date;
}): RiskPosture {
  const actionsVerified = Boolean(actions && isPublicActionsSample(actions, repository));
  const pullsVerified = Boolean(pulls && isPublicPullSample(pulls, repository));
  const actionsFreshness = actionsVerified
    ? receiptFreshness(actionsReceivedAt, asOf) : 'unverified';
  const pullsFreshness = pullsVerified
    ? receiptFreshness(prsReceivedAt, asOf) : 'unverified';
  const a = actionsVerified && actionsFreshness !== 'unverified' ? actions : null;
  const p = pullsVerified && pullsFreshness !== 'unverified' ? pulls : null;
  const workflow = {
    freshness: a ? actionsFreshness : 'unverified' as EvidenceFreshness,
    inspected: a?.inspected_runs ?? 0,
    uninspected: a ? a.total_matching_runs - a.inspected_runs : 0,
    failed: a ? a.runs.filter(run => run.status === 'completed' &&
      isConfirmedWorkflowFailure(run.conclusion)).length : 0,
    truncated: Boolean(a && a.total_matching_runs > a.inspected_runs),
  };
  const pullRequests = {
    freshness: p ? pullsFreshness : 'unverified' as EvidenceFreshness,
    inspected: p?.inspected_prs ?? 0,
    conflicts: p?.conflicts ?? 0,
    reviewStates: p ? p.pull_requests.filter(pr =>
      pr.attention === 'blocked' || pr.attention === 'behind' ||
      pr.attention === 'unstable').length : 0,
    unknown: p?.unknown ?? 0,
    moreOpenMayExist: p?.more_open_prs ?? false,
  };
  const hasActions = workflow.freshness !== 'unverified';
  const hasPrs = pullRequests.freshness !== 'unverified';
  const coverage: RiskPosture['coverage'] = hasActions && hasPrs ? 'both' :
    hasActions ? 'actions_only' : hasPrs ? 'prs_only' : 'none';
  const stale = workflow.freshness === 'stale' || pullRequests.freshness === 'stale';
  const recentFailed = workflow.freshness === 'recent' ? workflow.failed : 0;
  const recentConflicts = pullRequests.freshness === 'recent' ? pullRequests.conflicts : 0;
  const recentReview = pullRequests.freshness === 'recent'
    ? pullRequests.reviewStates + pullRequests.unknown : 0;

  const state: RiskPostureState = recentFailed + recentConflicts > 0
    ? 'investigate_observed'
    : recentReview > 0 ? 'review_observed'
      : stale ? 'refresh_before_decision'
        : coverage === 'none' ? 'await_evidence' : 'no_confirmed_signal';
  const titles: Record<RiskPostureState, string> = {
    investigate_observed: 'Confirmed signals in sampled records',
    review_observed: 'Review or unresolved status in sampled PRs',
    refresh_before_decision: 'Refresh stale GitHub evidence before deciding',
    no_confirmed_signal: 'No confirmed issue in the available sample',
    await_evidence: 'Awaiting verified GitHub evidence',
  };
  const evidenceLimitations: string[] = [];
  if (!hasActions) evidenceLimitations.push('Actions sample unavailable or invalid');
  if (!hasPrs) evidenceLimitations.push('PR sample unavailable or invalid');
  if (workflow.truncated) evidenceLimitations.push('Additional workflow runs are uninspected');
  if (pullRequests.moreOpenMayExist) evidenceLimitations.push('Additional open PRs may exist');
  if (stale) evidenceLimitations.push('One or more source receipts are older than 30 minutes');
  // Even complete lists here are only current, bounded API views and not check suites.
  evidenceLimitations.push('No branch-protection, required-check or merge-approval verification');
  return {
    state, headline: titles[state], repository, workflow, pullRequests,
    coverage, evidenceLimitations, releaseAuthorized: false,
  };
}
