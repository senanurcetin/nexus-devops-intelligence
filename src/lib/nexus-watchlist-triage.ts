import { JARVIS_DIGEST_SCHEMA, sanitizeDigestText, type JarvisDigest } from './nexus-jarvis-digest.ts';
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
  'anonymous GitHub reads). Only investigations from verified source receipts contribute counts and links. ' +
  '"no_confirmed_signal" means nothing was observed in that sample, not that the ' +
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

/** Require a real, canonical UTC receipt time, not a bare 'verified' label. */
function verifiedSourceReceipt(source: JarvisDigest['sources']['actions'] | undefined): boolean {
  const timestamp = source?.received_at_utc;
  return source?.state === 'verified' && source.http_status === 200 &&
    typeof timestamp === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(timestamp) &&
    Number.isFinite(Date.parse(timestamp)) && new Date(timestamp).toISOString() === timestamp;
}

/**
 * JSON returned by the local MCP adapter is still an untrusted wire value.
 * A valid status from an unrelated repository (or a mutated "write-enabled"
 * envelope) must not be relabeled as evidence for the requested repository.
 */
function verifiedDigestFor(repository: string, digest: JarvisDigest | null): digest is JarvisDigest {
  if (!digest || digest.schema !== JARVIS_DIGEST_SCHEMA ||
      digest.data_source !== 'public-github-rest-via-local-nexus-devops' ||
      typeof digest.repository !== 'string' ||
      digest.repository.toLowerCase() !== repository.toLowerCase() ||
      digest.access?.mode !== 'read_only' || !Array.isArray(digest.access.write_actions) ||
      digest.access.write_actions.length !== 0 || digest.access.release_authorized !== false ||
      digest.access.merge_approval !== false ||
      digest.posture?.releaseAuthorized !== false ||
      typeof digest.posture.repository !== 'string' ||
      digest.posture.repository.toLowerCase() !== repository.toLowerCase() ||
      !digest.sources?.actions ||
      !digest.sources?.pull_requests || !isPostureState(digest.posture?.state) ||
      !Array.isArray(digest.investigations) || digest.investigations.length > 5 ||
      !digest.investigations.every(item => item && ['high', 'medium', 'info'].includes(item.severity))) {
    return false;
  }
  return verifiedSourceReceipt(digest.sources.actions) || verifiedSourceReceipt(digest.sources.pull_requests);
}

/**
 * Source links appear in Markdown without a text wrapper. Accept only the
 * exact public GitHub run/PR URL shape for the requested repository and
 * investigation kind, then construct the output URL from trusted components.
 */
function verifiedSourceUrl(repository: string, source: JarvisDigest['investigations'][number] | undefined): string | null {
  if (!source || typeof source.source_url !== 'string') return null;
  const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/(actions\/runs|pull)\/([1-9][0-9]*)$/.exec(source.source_url);
  if (!match || `${match[1]}/${match[2]}`.toLowerCase() !== repository.toLowerCase() ||
      !Number.isSafeInteger(Number(match[4])) ||
      (source.source_type === 'workflow_run' ? match[3] !== 'actions/runs'
        : source.source_type === 'pull_request' ? match[3] !== 'pull' : true)) return null;
  return `https://github.com/${repository}/${match[3]}/${Number(match[4])}`;
}

function toEntry({ repository, digest }: WatchlistInput): WatchlistEntry {
  if (!verifiedDigestFor(repository, digest)) {
    return {
      repository, readable: false, posture_state: null, headline: 'digest unavailable',
      high: 0, medium: 0, info: 0, coverage: 'none', first_url: null,
      note: 'No verified source for this repository; retry later. Absence of data is not a clean result.',
    };
  }
  // Source status labels are not sufficient: each investigation must be backed
  // by its own source's canonical, verified receipt before it can be counted or linked.
  const actionsVerified = verifiedSourceReceipt(digest.sources.actions);
  const pullsVerified = verifiedSourceReceipt(digest.sources.pull_requests);
  const verifiedInvestigations = digest.investigations.filter(item =>
    item.source_type === 'workflow_run' ? actionsVerified :
      item.source_type === 'pull_request' ? pullsVerified : false);
  const count = (severity: 'high' | 'medium' | 'info') =>
    verifiedInvestigations.filter(item => item.severity === severity).length;
  return {
    repository,
    readable: true,
    posture_state: digest.posture.state,
    headline: sanitizeDigestText(digest.posture.headline, 160),
    high: count('high'), medium: count('medium'), info: count('info'),
    coverage: sanitizeDigestText(digest.posture.coverage, 20),
    first_url: verifiedSourceUrl(repository, verifiedInvestigations[0]),
    note: !actionsVerified || !pullsVerified
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

// Escape untrusted Markdown/HTML as table text. Source URLs are validated separately.
const cell = (value: string) => sanitizeDigestText(value, 600)
  .replace(/\|/g, '/').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/[\\`*_{}\[\]()#+.!~-]/g, '\\$&');

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
