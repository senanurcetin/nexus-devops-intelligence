import { parsePublicRepository, type PublicActionsSummary } from './github-public-actions.ts';
import type { PublicPullSummary } from './nexus-public-prs.ts';
import { isPublicActionsSample, isPublicPullSample } from './nexus-panel-validation.ts';
import { filteredWorkflowRuns, type WorkflowFilter } from './nexus-workflow-visuals.ts';
import { filteredPublicPulls, type PullFilter } from './nexus-pr-visuals.ts';

/**
 * Browser-only export of source-verified, bounded public samples.
 * No fetch, local storage, tokens, server round trip, or source mutation.
 */
export type SampleExportInput = {
  repository: string;
  actions: PublicActionsSummary | null;
  prs: PublicPullSummary | null;
  actionsReceivedAt: string | null;
  prsReceivedAt: string | null;
  workflowFilter: WorkflowFilter;
  pullFilter: PullFilter;
  exportedAt: string;
};

type WorkflowRecord = PublicActionsSummary['runs'][number];
type PullRecord = PublicPullSummary['pull_requests'][number];

export type PublicSampleExport = {
  schema_version: 1;
  kind: 'nexus-public-sample';
  repository: string;
  data_source: 'public-github-rest';
  exported_at_utc: string;
  scope_note: string;
  sample_limits: { workflow_runs: 10; open_pull_requests: 5 };
  applied_filters: { workflows: WorkflowFilter; pull_requests: PullFilter };
  actions: null | {
    received_at_utc: string;
    total_matching_runs: number;
    inspected_runs: number;
    exported_runs: number;
    scope_note: string;
    records: WorkflowRecord[];
  };
  pull_requests: null | {
    received_at_utc: string;
    inspected_prs: number;
    more_open_prs: boolean;
    exported_prs: number;
    scope_note: string;
    records: PullRecord[];
  };
};

const workflowFilters = new Set<WorkflowFilter>(['all', 'success', 'failed', 'pending', 'other']);
const prFilters = new Set<PullFilter>(['all', 'conflict', 'restrictions', 'unverified', 'clean', 'draft']);

const validUtc = (value: string | null): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

export function createPublicSampleExport(input: SampleExportInput): PublicSampleExport {
  parsePublicRepository(input.repository);
  if (!workflowFilters.has(input.workflowFilter) || !prFilters.has(input.pullFilter) ||
      !validUtc(input.exportedAt)) {
    throw new Error('Invalid export filters or timestamp.');
  }
  if (!input.actions && !input.prs) {
    throw new Error('No verified public sample available to export.');
  }
  if ((input.actions && (!validUtc(input.actionsReceivedAt) ||
        !isPublicActionsSample(input.actions, input.repository))) ||
      (input.prs && (!validUtc(input.prsReceivedAt) ||
        !isPublicPullSample(input.prs, input.repository)))) {
    throw new Error('A source is unverified or has no valid receipt timestamp.');
  }

  const actions = input.actions ? {
    received_at_utc: input.actionsReceivedAt as string,
    total_matching_runs: input.actions.total_matching_runs,
    inspected_runs: input.actions.inspected_runs,
    exported_runs: filteredWorkflowRuns(input.actions, input.workflowFilter).length,
    scope_note: input.actions.scope_note,
    records: filteredWorkflowRuns(input.actions, input.workflowFilter).map(run => ({
      id: run.id, name: run.name, event: run.event, status: run.status,
      conclusion: run.conclusion, created_at: run.created_at, html_url: run.html_url,
      ...(run.head_sha ? { head_sha: run.head_sha } : {}),
      ...(run.head_branch ? { head_branch: run.head_branch } : {}),
    })),
  } : null;

  const pull_requests = input.prs ? {
    received_at_utc: input.prsReceivedAt as string,
    inspected_prs: input.prs.inspected_prs,
    more_open_prs: input.prs.more_open_prs,
    exported_prs: filteredPublicPulls(input.prs, input.pullFilter).length,
    scope_note: input.prs.scope_note,
    records: filteredPublicPulls(input.prs, input.pullFilter).map(pr => ({
      number: pr.number, title: pr.title, author: pr.author,
      updated_at: pr.updated_at, html_url: pr.html_url,
      attention: pr.attention, explanation: pr.explanation,
      ...(pr.head_sha ? { head_sha: pr.head_sha } : {}),
    })),
  } : null;

  return {
    schema_version: 1,
    kind: 'nexus-public-sample',
    repository: input.repository,
    data_source: 'public-github-rest',
    exported_at_utc: input.exportedAt,
    scope_note: 'Read-only public Github samples, not a full audit, a CI guarantee, or merge approval. Filtered exports do not imply uninspected records were checked.',
    sample_limits: { workflow_runs: 10, open_pull_requests: 5 },
    applied_filters: { workflows: input.workflowFilter, pull_requests: input.pullFilter },
    actions, pull_requests,
  };
}

/** Prevent spreadsheet formula execution from any untrusted public GitHub text. */
export function safeCsvCell(value: string | number | boolean | null | undefined): string {
  let text = value == null ? '' : String(value);
  // Strip control and bidirectional formatting characters that can obscure a
  // spreadsheet prefix; preserve ordinary Unicode and escaped CSV quotes.
  text = text.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, ' ');
  if (/^\s*[=+\-@]/u.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

const CSV_COLUMNS = [
  'row_type', 'repository', 'exported_at_utc', 'received_at_utc',
  'sample_limit', 'inspected_count', 'exported_count', 'applied_filter',
  'more_open_prs', 'id', 'title', 'author', 'event', 'status', 'conclusion',
  'created_at', 'updated_at', 'attention', 'explanation', 'html_url',
] as const;

type CsvRow = Partial<Record<typeof CSV_COLUMNS[number], string | number | boolean | null>>;

export function serializePublicSampleCsv(snapshot: PublicSampleExport): string {
  const rows: CsvRow[] = [];

  if (snapshot.actions) {
    const a = snapshot.actions;
    const common = {
      repository: snapshot.repository, exported_at_utc: snapshot.exported_at_utc,
      received_at_utc: a.received_at_utc, sample_limit: 10,
      inspected_count: a.inspected_runs, exported_count: a.exported_runs,
      applied_filter: snapshot.applied_filters.workflows,
    };
    rows.push({ row_type: 'actions_sample_metadata', ...common });
    for (const run of a.records) {
      rows.push({
        row_type: 'workflow_run', ...common, id: run.id, title: run.name,
        event: run.event, status: run.status, conclusion: run.conclusion,
        created_at: run.created_at, html_url: run.html_url,
      });
    }
  }

  if (snapshot.pull_requests) {
    const p = snapshot.pull_requests;
    const common = {
      repository: snapshot.repository, exported_at_utc: snapshot.exported_at_utc,
      received_at_utc: p.received_at_utc, sample_limit: 5,
      inspected_count: p.inspected_prs, exported_count: p.exported_prs,
      applied_filter: snapshot.applied_filters.pull_requests,
      more_open_prs: p.more_open_prs,
    };
    rows.push({ row_type: 'pr_sample_metadata', ...common });
    for (const pr of p.records) {
      rows.push({
        row_type: 'pull_request', ...common, id: pr.number,
        title: pr.title, author: pr.author, updated_at: pr.updated_at,
        attention: pr.attention, explanation: pr.explanation, html_url: pr.html_url,
      });
    }
  }

  return [CSV_COLUMNS.map(safeCsvCell).join(','),
    ...rows.map(row => CSV_COLUMNS.map(name => safeCsvCell(row[name])).join(',')),
  ].join('\r\n') + '\r\n';
}

export function createSampleFilename(repository: string, exportedAt: string, format: 'csv' | 'json'): string {
  parsePublicRepository(repository);
  if (!validUtc(exportedAt)) throw new Error('Invalid export filename timestamp.');
  const safeRepo = repository.toLowerCase().replace('/', '-');
  const timestamp = exportedAt.slice(0, 19).replace(/[-:T]/g, '');
  return 'nexus-' + safeRepo + '-sample-' + timestamp + '-utc.' + format;
}
