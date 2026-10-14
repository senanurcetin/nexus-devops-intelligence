import { parsePublicRepository, isConfirmedWorkflowFailure } from './github-public-actions.ts';

export const TREND_DAYS = 7;
export const TREND_PAGE_LIMIT = 100;
export type TrendDay = {
  day_utc: string;
  success: number;
  failed: number;
  pending: number;
  other: number;
  total: number;
};
export type PublicWorkflowTrend = {
  repository: string;
  start_utc: string;
  end_utc: string;
  coverage: 'complete' | 'incomplete';
  total_matching_runs: number;
  inspected_runs: number;
  days: TrendDay[];
  scope_note: string;
};

const DAY_MS = 86_400_000;
const active = new Set(['queued', 'in_progress', 'requested', 'waiting', 'pending']);
const isCount = (n: unknown): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
const isText = (v: unknown, cap: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= cap;
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Last complete UTC day only (or a recent earlier window ending within 30
 * complete days). No future, rolling hour, timezone-local or huge-range query.
 */
export function trendWindow(end: string, now: Date = new Date()): {
  start_utc: string;
  end_utc: string;
  start_ms: number;
  end_exclusive_ms: number;
} {
  if (typeof end !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw new Error('Invalid trend UTC end date.');
  }
  const ms = Date.parse(end + 'T00:00:00.000Z');
  if (!Number.isFinite(ms) || utcDay(ms) !== end ||
      !Number.isFinite(now.valueOf())) throw new Error('Invalid trend UTC end date.');
  const lastComplete = Date.parse(utcDay(now.valueOf()) + 'T00:00:00.000Z') - DAY_MS;
  if (ms > lastComplete || ms < lastComplete - 29 * DAY_MS) {
    throw new Error('Trend end must be within the last 30 completed UTC days.');
  }
  return {
    start_utc: utcDay(ms - (TREND_DAYS - 1) * DAY_MS),
    end_utc: end,
    start_ms: ms - (TREND_DAYS - 1) * DAY_MS,
    end_exclusive_ms: ms + DAY_MS,
  };
}

/** Only a fully enumerated date window qualifies for a daily comparison. */
export function summarizePublicWorkflowTrend(
  repository: string,
  end: string,
  payload: unknown,
  now: Date = new Date(),
): PublicWorkflowTrend {
  parsePublicRepository(repository);
  const window = trendWindow(end, now);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid GitHub trend response.');
  }
  const body = payload as { total_count?: unknown; workflow_runs?: unknown };
  if (!isCount(body.total_count) || !Array.isArray(body.workflow_runs) ||
      body.workflow_runs.length > TREND_PAGE_LIMIT ||
      body.total_count < body.workflow_runs.length) {
    throw new Error('Inconsistent workflow trend count.');
  }
  const total = body.total_count;
  const rows = body.workflow_runs;
  const complete = total === rows.length;
  // Even if a truncated page is received, validate all displayed source IDs
  // and dates; don't report counts on an untrusted or unrelated data window.
  const buckets: TrendDay[] = Array.from({ length: TREND_DAYS }, (_, i) => ({
    day_utc: utcDay(window.start_ms + i * DAY_MS),
    success: 0, failed: 0, pending: 0, other: 0, total: 0,
  }));
  const seen = new Set<number>();
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('Invalid workflow trend item.');
    }
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== 'number' || !Number.isSafeInteger(item.id) || item.id <= 0 ||
        seen.has(item.id) ||
        item.html_url !== 'https://github.com/' + repository + '/actions/runs/' + item.id ||
        !isText(item.status, 80) ||
        !(item.conclusion === null || isText(item.conclusion, 80)) ||
        !isText(item.created_at, 90) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(item.created_at)) {
      throw new Error('Unverified workflow trend source.');
    }
    const timestamp = Date.parse(item.created_at);
    if (!Number.isFinite(timestamp) ||
        timestamp < window.start_ms || timestamp >= window.end_exclusive_ms) {
      throw new Error('Workflow lies outside the requested UTC window.');
    }
    seen.add(item.id);
    if (!complete) continue;
    const index = Math.floor((timestamp - window.start_ms) / DAY_MS);
    const b = buckets[index];
    b.total++;
    if (active.has(item.status as string)) b.pending++;
    else if (item.status === 'completed' && item.conclusion === 'success') b.success++;
    else if (item.status === 'completed' &&
      isConfirmedWorkflowFailure(item.conclusion as string | null)) b.failed++;
    else b.other++;
  }
  return {
    repository,
    start_utc: window.start_utc,
    end_utc: window.end_utc,
    coverage: complete ? 'complete' : 'incomplete',
    total_matching_runs: total,
    inspected_runs: rows.length,
    days: complete ? buckets : [],
    scope_note: complete
      ? 'All workflow runs returned by GitHub for these seven complete UTC creation dates were enumerated in one 100-item page. Categories represent current API states at request time, not historical daily final CI results, incident causes or time-based reliability SLAs.'
      : 'GitHub returned only a subset for this UTC window. Daily charts and percentages are deliberately suppressed; select a less active repository or verify full history on GitHub.',
  };
}

/** Browser boundary: revalidate window and exact daily totals before charting. */
export function isPublicWorkflowTrend(
  payload: unknown, repository: string, end: string, now: Date = new Date(),
): payload is PublicWorkflowTrend {
  try {
    parsePublicRepository(repository);
    const { start_utc } = trendWindow(end, now);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    const p = payload as Partial<PublicWorkflowTrend>;
    if (p.repository !== repository || p.start_utc !== start_utc ||
        p.end_utc !== end || !['complete','incomplete'].includes(p.coverage ?? '') ||
        !isCount(p.total_matching_runs) || !isCount(p.inspected_runs) ||
        p.inspected_runs > TREND_PAGE_LIMIT ||
        p.total_matching_runs < p.inspected_runs ||
        !isText(p.scope_note, 700) || !Array.isArray(p.days)) return false;
    if (p.coverage === 'incomplete') {
      return p.total_matching_runs > p.inspected_runs && p.days.length === 0;
    }
    if (p.total_matching_runs !== p.inspected_runs || p.days.length !== TREND_DAYS) return false;
    let sum = 0;
    for (let i = 0; i < TREND_DAYS; i++) {
      const d = p.days[i];
      const day = utcDay(Date.parse(start_utc + 'T00:00:00.000Z') + i * DAY_MS);
      if (!d || d.day_utc !== day || !isCount(d.success) ||
          !isCount(d.failed) || !isCount(d.pending) ||
          !isCount(d.other) || !isCount(d.total) ||
          d.success + d.failed + d.pending + d.other !== d.total) return false;
      sum += d.total;
    }
    return sum === p.total_matching_runs;
  } catch { return false; }
}
