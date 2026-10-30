import { sanitizeDigestText, type JarvisDigest } from './nexus-jarvis-digest.ts';
import type { RiskPostureState } from './nexus-risk-posture.ts';

/**
 * P3 slice 5 (personal edition): a deterministic READING ORDER for several public
 * repositories, built only from digests this service already produced. It adds no
 * data source, no score, no probability and no AI judgement. The order is a
 * lexicographic rule that is printed with the result, so the owner can see why one
 * repository is listed before another. A repository without a confirmed signal is
 * NOT reported as safe, and the order is not approval to merge or release.
 */
export const WATCHLIST_MAX_REPOSITORIES = 10;

export const WATCHLIST_ORDER_RULE =
  'Reading order, not a risk score: (1) posture state: investigate_observed, review_observed, ' +
  'refresh_before_decision, await_evidence, no_confirmed_signal; (2) more high-severity ' +
  'investigations first; (3) more investigations in total first; (4) repository name A-Z. ' +
  'Repositories whose digest could not be read are listed last.';

export const WATCHLIST_SCOPE_NOTE =
  'Each row comes from the same bounded public sample as a single digest (10 workflow runs, 5 open PRs, ' +
  'anonymous GitHub reads). "no_confirmed_signal" means nothing was observed in that sample, not that the ' +
  'repository is safe. This is not an audit and not approval to merge, release, deploy or retry.';

const POSTURE_RANK: Record<RiskPostureState, number> = {
  investigate_observed: 0,
  review_observed: 1,
  refresh_before_decision: 2,
  await_evidence: 3,
  no_confirmed_signal: 4,
};

export type WatchlistEntry = {
  repository: string;
  readable: boolean;
  posture_state: RiskPostureState | null;
  headline: string;
  high: number;
  medium: number;
  info: number;
  coverage: string;
  first_url: string | null;
  note: string | null;
};

export type WatchlistTriage = {
  generated_at_utc: string;
  order_rule: string;
  scope_note: string;
  entries: WatchlistEntry[];
  requested: number;
  readable: number;
};

export type WatchlistInput = { repository: string; digest: JarvisDigest | null };

const isPostureState = (value: unknown): value is RiskPostureState =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(POSTURE_RANK, value);

function toEntry({ repository, digest }: WatchlistInput): WatchlistEntry {
  const sourcesRead = digest &&
    (digest.sources.actions.state === 'verified' || digest.sources.pull_requests.state === 'verified');
  if (!digest || !sourcesRead || !isPostureState(digest.posture?.state)) {
    return {
      repository, readable: false, posture_state: null, headline: 'digest unavailable',
      high: 0, medium: 0, info: 0, coverage: 'none', first_url: null,
      note: 'No verified source for this repository; retry later. Absence of data is not a clean result.',
    };
  }
  const count = (severity: 'high' | 'medium' | 'info') =>
    digest.investigations.filter(item => item.severity === severity).length;
  return {
    repository: digest.repository,
    readable: true,
    posture_state: digest.posture.state,
    headline: sanitizeDigestText(digest.posture.headline, 160),
    high: count('high'), medium: count('medium'), info: count('info'),
    coverage: sanitizeDigestText(digest.posture.coverage, 20),
    first_url: digest.investigations[0]?.source_url ?? null,
    note: digest.sources.actions.state !== 'verified' || digest.sources.pull_requests.state !== 'verified'
      ? 'Only one of the two sources was verified for this repository.' : null,
  };
}

const total = (e: WatchlistEntry) => e.high + e.medium + e.info;

export function triageWatchlist(inputs: WatchlistInput[], now: Date): WatchlistTriage {
  const seen = new Set<string>();
  const unique = inputs.filter(item => {
    const key = item.repository.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, WATCHLIST_MAX_REPOSITORIES);
  const entries = unique.map(toEntry).sort((a, b) => {
    if (a.readable !== b.readable) return a.readable ? -1 : 1;
    if (a.readable && b.readable) {
      const rank = POSTURE_RANK[a.posture_state as RiskPostureState] - POSTURE_RANK[b.posture_state as RiskPostureState];
      if (rank) return rank;
      if (a.high !== b.high) return b.high - a.high;
      if (total(a) !== total(b)) return total(b) - total(a);
    }
    return a.repository.toLowerCase() < b.repository.toLowerCase() ? -1
      : a.repository.toLowerCase() > b.repository.toLowerCase() ? 1 : 0;
  });
  return {
    generated_at_utc: now.toISOString(),
    order_rule: WATCHLIST_ORDER_RULE,
    scope_note: WATCHLIST_SCOPE_NOTE,
    entries,
    requested: unique.length,
    readable: entries.filter(e => e.readable).length,
  };
}

const cell = (value: string) => value.replace(/\|/g, '/').replace(/[\r\n]+/g, ' ');

/** Markdown for the owner; every repository-derived string is already sanitised text. */
export function watchlistMarkdown(triage: WatchlistTriage): string {
  const lines = [
    '# Watchlist reading order',
    '',
    `Generated (UTC): ${triage.generated_at_utc}. Repositories read: ${triage.readable} of ${triage.requested}.`,
    '',
    `Order rule: ${triage.order_rule}`,
    '',
    `Scope: ${triage.scope_note}`,
    '',
    '| # | Repository | Posture | High / Med / Info | Coverage | First link | Note |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  triage.entries.forEach((e, i) => {
    lines.push(`| ${i + 1} | ${cell(e.repository)} | ${cell(e.posture_state ?? 'unavailable')}: ${cell(e.headline)} | ` +
      `${e.high} / ${e.medium} / ${e.info} | ${cell(e.coverage)} | ${e.first_url ?? '-'} | ${cell(e.note ?? '')} |`);
  });
  return lines.join('\n') + '\n';
}
