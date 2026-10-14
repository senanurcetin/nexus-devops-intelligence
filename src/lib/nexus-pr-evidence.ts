import { parsePublicRepository } from './github-public-actions.ts';

export type PublicPrCheck = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
};
export type PublicPrReviewEvent = {
  id: number;
  author: string;
  state: string;
  submitted_at: string | null;
};
export type PublicPrVerification = {
  repository: string;
  number: number;
  html_url: string;
  head_sha: string;
  total_check_runs: number;
  inspected_check_runs: number;
  check_runs: PublicPrCheck[];
  inspected_review_events: number;
  more_review_events_may_exist: boolean;
  review_events: PublicPrReviewEvent[];
  scope_note: string;
};
export const PR_VERIFICATION_SAMPLE_LIMIT = 30;

const object = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? v as Record<string, unknown> : null;
const int = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const str = (v: unknown, max = 300): v is string =>
  typeof v === 'string' && v.length <= max;
const iso = (v: unknown): v is string | null =>
  v === null || (str(v, 100) && Number.isFinite(Date.parse(v)));

export function parsePublicPrNumber(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,9}$/.test(value)) {
    throw new Error('Invalid public PR number.');
  }
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n > 2147483647) throw new Error('Invalid public PR number.');
  return n;
}

/** Reject cross-repository and untrusted payloads at the browser boundary. */
export function isPublicPrVerification(
  value: unknown, repository: string, number: number,
): value is PublicPrVerification {
  try { parsePublicRepository(repository); } catch { return false; }
  const data = object(value);
  if (!data || data.repository !== repository || data.number !== number ||
      data.html_url !== 'https://github.com/' + repository + '/pull/' + number ||
      !str(data.head_sha, 40) || !/^[a-fA-F0-9]{40}$/.test(data.head_sha) ||
      !int(data.total_check_runs) || !int(data.inspected_check_runs) ||
      data.inspected_check_runs > PR_VERIFICATION_SAMPLE_LIMIT ||
      data.total_check_runs < data.inspected_check_runs ||
      !Array.isArray(data.check_runs) ||
      data.check_runs.length !== data.inspected_check_runs ||
      !int(data.inspected_review_events) ||
      data.inspected_review_events > PR_VERIFICATION_SAMPLE_LIMIT ||
      data.more_review_events_may_exist !== (data.inspected_review_events === PR_VERIFICATION_SAMPLE_LIMIT) ||
      !Array.isArray(data.review_events) ||
      data.review_events.length !== data.inspected_review_events ||
      !str(data.scope_note, 800)) return false;
  const checkIds = new Set<number>();
  for (const raw of data.check_runs) {
    const c = object(raw);
    if (!c || !int(c.id) || c.id < 1 || checkIds.has(c.id) ||
        !str(c.name, 300) || !str(c.status, 70) ||
        !(c.conclusion === null || str(c.conclusion, 70))) return false;
    checkIds.add(c.id);
  }
  const reviewIds = new Set<number>();
  for (const raw of data.review_events) {
    const r = object(raw);
    if (!r || !int(r.id) || r.id < 1 || reviewIds.has(r.id) ||
        !str(r.author, 100) || !str(r.state, 70) ||
        !iso(r.submitted_at)) return false;
    reviewIds.add(r.id);
  }
  return true;
}

/**
 * One already verified public PR; never infer current required approvals from
 * historical review events or global passing checks from sampled check runs.
 */
export function summarizePublicPrVerification(
  repository: string, number: number,
  pullData: unknown, checkData: unknown, reviewData: unknown,
): PublicPrVerification {
  parsePublicRepository(repository);
  parsePublicPrNumber(String(number));
  const expected = 'https://github.com/' + repository + '/pull/' + number;
  const pull = object(pullData), head = object(pull?.head), checks = object(checkData);
  if (!pull || pull.number !== number || pull.html_url !== expected ||
      pull.state !== 'open' || !str(head?.sha, 40) ||
      !/^[a-fA-F0-9]{40}$/.test(head.sha as string) ||
      !checks || !int(checks.total_count) ||
      !Array.isArray(checks.check_runs) ||
      checks.check_runs.length > PR_VERIFICATION_SAMPLE_LIMIT ||
      checks.total_count < checks.check_runs.length ||
      !Array.isArray(reviewData) || reviewData.length > PR_VERIFICATION_SAMPLE_LIMIT) {
    throw new Error('Invalid public PR verification response.');
  }
  const check_runs: PublicPrCheck[] = checks.check_runs.map(raw => {
    const c = object(raw);
    if (!c || !int(c.id) || c.id < 1 ||
        !str(c.name, 300) || !str(c.status, 70) ||
        !(c.conclusion === null || str(c.conclusion, 70))) {
      throw new Error('Invalid public PR check run.');
    }
    return { id: c.id, name: c.name as string, status: c.status as string,
      conclusion: c.conclusion as string | null };
  });
  const review_events: PublicPrReviewEvent[] = reviewData.map(raw => {
    const r = object(raw), user = object(r?.user);
    if (!r || !int(r.id) || r.id < 1 || !str(user?.login, 100) ||
        !str(r.state, 70) || !iso(r.submitted_at)) {
      throw new Error('Invalid public PR review event.');
    }
    return { id: r.id, author: user?.login as string,
      state: r.state as string, submitted_at: r.submitted_at as string | null };
  });
  const result: PublicPrVerification = {
    repository, number, html_url: expected,
    head_sha: head.sha as string,
    total_check_runs: checks.total_count as number,
    inspected_check_runs: check_runs.length,
    check_runs,
    inspected_review_events: review_events.length,
    more_review_events_may_exist: review_events.length === PR_VERIFICATION_SAMPLE_LIMIT,
    review_events,
    scope_note: 'User-requested public PR snapshot: up to 30 check runs and 30 chronological review events. Review events are historical, may be superseded or dismissed; sampled checks do not establish overall CI or branch-protection approval.',
  };
  if (!isPublicPrVerification(result, repository, number)) {
    throw new Error('Invalid public PR verification response.');
  }
  if (new Set(check_runs.map(x => x.id)).size !== check_runs.length ||
      new Set(review_events.map(x => x.id)).size !== review_events.length) {
    throw new Error('Duplicate public PR evidence identifiers.');
  }
  return result;
}
