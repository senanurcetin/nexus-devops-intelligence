import { parsePublicRepository } from './github-public-actions.ts';
import type { PublicSampleExport } from './nexus-public-sample-export.ts';
import { createSampleFilename } from './nexus-public-sample-export.ts';

/**
 * Evidence-first, client-side Markdown handoff. Uses only the already verified
 * F01 export snapshot: no fetch, persistence, claims of root cause or merge approval.
 */
const safeText = (value: string, limit = 240): string =>
  value
    .slice(0, limit)
    .replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2069\ufeff]/g, ' ')
    // Markdown allows raw HTML; escape HTML syntax as well as Markdown punctuation.
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_{}\[\]()#+.!|~-]/g, '\\$&')
    .trim();

function verifySnapshot(snapshot: PublicSampleExport): void {
  if (snapshot?.schema_version !== 1 || snapshot.kind !== 'nexus-public-sample' ||
      snapshot.data_source !== 'public-github-rest' ||
      !snapshot.actions && !snapshot.pull_requests) {
    throw new Error('Missing verified sample export.');
  }
  parsePublicRepository(snapshot.repository);
  // Only exported data is rendered; a separately provided snapshot cannot
  // smuggle arbitrary external or Javascript URLs into a downloadable report.
  const repoUrl = 'https://github.com/' + snapshot.repository;
  if (snapshot.actions) {
    if (snapshot.actions.exported_runs !== snapshot.actions.records.length ||
        snapshot.actions.inspected_runs > 10 ||
        snapshot.actions.inspected_runs < snapshot.actions.exported_runs) {
      throw new Error('Inconsistent workflow sample.');
    }
    for (const row of snapshot.actions.records) {
      if (!Number.isSafeInteger(row.id) || row.id < 1 ||
          row.html_url !== repoUrl + '/actions/runs/' + row.id) {
        throw new Error('Unexpected workflow source URL.');
      }
    }
  }
  if (snapshot.pull_requests) {
    if (snapshot.pull_requests.exported_prs !== snapshot.pull_requests.records.length ||
        snapshot.pull_requests.inspected_prs > 5 ||
        snapshot.pull_requests.inspected_prs < snapshot.pull_requests.exported_prs) {
      throw new Error('Inconsistent PR sample.');
    }
    for (const row of snapshot.pull_requests.records) {
      if (!Number.isSafeInteger(row.number) || row.number < 1 ||
          row.html_url !== repoUrl + '/pull/' + row.number) {
        throw new Error('Unexpected PR source URL.');
      }
    }
  }
}

export function createAuditBriefFilename(snapshot: PublicSampleExport): string {
  verifySnapshot(snapshot);
  return createSampleFilename(snapshot.repository, snapshot.exported_at_utc, 'json')
    .replace(/\.json$/, '-audit-brief.md');
}

export function createAuditBrief(snapshot: PublicSampleExport): string {
  verifySnapshot(snapshot);
  const source = 'https://github.com/' + snapshot.repository;
  const lines: string[] = [
    '# NEXUS DevOps — Evidence Brief',
    '',
    '> Investigation handoff, not a full repository audit, root-cause diagnosis,',
    '> branch-protection verification, merge approval, or production release authorization.',
    '',
    '## Provenance and coverage',
    '',
    '- Repository: [' + safeText(snapshot.repository) + '](' + source + ')',
    '- Source: anonymous public GitHub REST API; no write permissions',
    '- Exported (UTC): ' + safeText(snapshot.exported_at_utc),
    '- Limits: at most 10 recent workflow runs and 5 recently listed open PRs',
    '- Applied workflow filter: ' + safeText(snapshot.applied_filters.workflows),
    '- Applied PR filter: ' + safeText(snapshot.applied_filters.pull_requests),
    '',
  ];

  if (snapshot.actions) {
    const actions = snapshot.actions;
    lines.push(
      '### GitHub Actions (bounded sample)',
      '',
      '- Source received (UTC): ' + safeText(actions.received_at_utc),
      '- Inspected: ' + actions.inspected_runs + ' of ' + actions.total_matching_runs + ' matching runs',
      '- Included after filter: ' + actions.exported_runs,
      '- Source scope: ' + safeText(actions.scope_note, 700),
      '',
      '#### Inspected workflow evidence',
      '',
    );
    if (!actions.records.length) lines.push('No workflow rows match the current export filter.');
    for (const run of actions.records) {
      lines.push('- [Run #' + run.id + '](' + run.html_url + '): ' +
        safeText(run.name) + ' — status ' + safeText(run.status) +
        ', conclusion ' + safeText(run.conclusion ?? 'not supplied') +
        ', event ' + safeText(run.event) +
        ', created ' + safeText(run.created_at) + '.');
    }
    lines.push('');
  } else {
    lines.push('### GitHub Actions', '', 'Source unavailable or unverified. No workflow assessment.', '');
  }

  if (snapshot.pull_requests) {
    const prs = snapshot.pull_requests;
    lines.push(
      '### Open pull requests (bounded sample)',
      '',
      '- Source received (UTC): ' + safeText(prs.received_at_utc),
      '- Inspected open PRs: ' + prs.inspected_prs,
      '- More open PRs indicated by source: ' + (prs.more_open_prs ? 'yes' : 'no'),
      '- Included after filter: ' + prs.exported_prs,
      '- Source scope: ' + safeText(prs.scope_note, 700),
      '',
      '#### Inspected PR evidence',
      '',
    );
    if (!prs.records.length) lines.push('No PR rows match the current export filter.');
    for (const pr of prs.records) {
      lines.push('- [PR #' + pr.number + '](' + pr.html_url + '): ' +
        safeText(pr.title) + ' — reported classification ' + safeText(pr.attention) +
        ', author ' + safeText(pr.author) +
        ', updated ' + safeText(pr.updated_at) + '.');
    }
    lines.push('');
  } else {
    lines.push('### Open pull requests', '', 'Source unavailable or unverified. No PR assessment.', '');
  }
  lines.push(
    '## Manual investigation and release checks',
    '',
    '1. Re-open the linked GitHub records; the snapshot may be stale.',
    '2. Check required reviews, branch protection, commit SHA, all checks, and full workflow logs in GitHub.',
    '3. Determine whether uninspected records or filters omit relevant failures.',
    '4. Run and record source-exact tests, security review, device QA, deployment/rollback authorization separately.',
    '',
    '**Decision:** Not established by this bounded sample. No automatic merge, retry, deployment, or external API calls were performed to prepare this report.',
    '',
  );
  return lines.join('\n');
}
