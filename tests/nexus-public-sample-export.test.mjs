import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPublicSampleExport, createSampleFilename,
  serializePublicSampleCsv, safeCsvCell,
} from '../src/lib/nexus-public-sample-export.ts';

const repo = 'owner/repository';
const received = '2026-10-14T10:21:35.000Z';
const exported = '2026-10-14T10:22:01.000Z';

const run = (id, status, conclusion, name = 'Build') => ({
  id, name, status, conclusion, event: 'push',
  created_at: received,
  html_url: 'https://github.com/' + repo + '/actions/runs/' + id,
});
const pr = (number, attention, title = 'Improve README') => ({
  number, title, author: 'contributor',
  updated_at: received,
  html_url: 'https://github.com/' + repo + '/pull/' + number,
  attention, explanation: 'Reported state is not merge approval.',
});
const actions = () => ({
  repository: repo,
  total_matching_runs: 120,
  inspected_runs: 4,
  successful_runs: 1,
  failed_runs: 1,
  pending_runs: 1,
  other_outcome_runs: 1,
  runs: [
    run(11, 'completed', 'success', '=HYPERLINK("https://bad.example","open")'),
    run(12, 'completed', 'failure', 'Lint'),
    run(13, 'queued', null, 'Waiting'),
    run(14, 'completed', 'cancelled', 'Cancelled'),
  ],
  scope_note: 'Up to 10 recent workflow runs; not historical reliability.',
});
const prs = () => ({
  repository: repo, inspected_prs: 3, more_open_prs: true,
  conflicts: 1, needs_attention: 2, unknown: 1,
  pull_requests: [
    pr(77, 'conflict', '+cmd | powershell -c Invoke-WebRequest'),
    pr(78, 'unknown', '\t=1+2'),
    pr(79, 'clear', 'Clean does not imply merge permission'),
  ],
  scope_note: 'Up to five open PRs; not a full audit.',
});
const input = (overrides = {}) => ({
  repository: repo,
  actions: actions(),
  prs: prs(),
  actionsReceivedAt: received,
  prsReceivedAt: received,
  workflowFilter: 'all',
  pullFilter: 'all',
  exportedAt: exported,
  ...overrides,
});

test('F-01: snapshot exports only the current verified filtered visible records', () => {
  const x = input({ workflowFilter: 'failed', pullFilter: 'restrictions' });
  const before = JSON.stringify(x);
  const result = createPublicSampleExport(x);
  assert.equal(result.schema_version, 1);
  assert.equal(result.kind, 'nexus-public-sample');
  assert.equal(result.repository, repo);
  assert.equal(result.exported_at_utc, exported);
  assert.equal(result.actions.received_at_utc, received);
  assert.equal(result.pull_requests.received_at_utc, received);
  assert.deepEqual(result.sample_limits, { workflow_runs: 10, open_pull_requests: 5 });
  assert.deepEqual(result.applied_filters, { workflows: 'failed', pull_requests: 'restrictions' });
  assert.equal(result.actions.inspected_runs, 4);
  assert.equal(result.actions.exported_runs, 1);
  assert.deepEqual(result.actions.records.map(x => x.id), [12]);
  assert.equal(result.pull_requests.inspected_prs, 3);
  assert.equal(result.pull_requests.exported_prs, 0);
  assert.equal(result.pull_requests.more_open_prs, true);
  assert.deepEqual(result.pull_requests.records, []);
  assert.equal(JSON.stringify(x), before, 'source API JSON stays unchanged');
});

test('F-01: healthy source remains exportable when sibling unavailable, with no phantom timestamp', () => {
  const result = createPublicSampleExport(input({
    actions: null, actionsReceivedAt: null, workflowFilter: 'success',
  }));
  assert.equal(result.actions, null);
  assert.equal(result.pull_requests.records.length, 3);
  assert.equal(result.pull_requests.exported_prs, 3);
  const csv = serializePublicSampleCsv(result);
  assert.match(csv, /pr_sample_metadata/);
  assert.doesNotMatch(csv, /actions_sample_metadata/);
  assert.match(csv, /public-github-rest|pr_sample_metadata/);
});

test('F-01: refuses no verified data, missing receipt, mismatched repository or invalid timestamps', () => {
  const invalid = [
    { actions: null, prs: null },
    { actionsReceivedAt: null },
    { prsReceivedAt: 'yesterday' },
    { exportedAt: '2026-10-14' },
    { repository: '../bad' },
    { actions: { ...actions(), repository: 'owner/different' } },
    { prs: { ...prs(), repository: 'owner/different' } },
    { workflowFilter: 'everything' },
    { pullFilter: 'other' },
    { exportedAt: '2026-13-14T10:22:01.000Z' },
  ];
  for (const item of invalid) {
    assert.throws(() => createPublicSampleExport(input(item)), Error, JSON.stringify(item).slice(0, 200));
  }
});

test('F-01: refuses poisoned URLs and samples exceeding the source limits', () => {
  const invalid = [
    { actions: { ...actions(), inspected_runs: 11 } },
    { prs: { ...prs(), inspected_prs: 8 } },
    { actions: { ...actions(), runs: actions().runs.map((r, i) =>
      i === 0 ? { ...r, html_url: 'https://attacker.invalid/exfiltrate' } : r) } },
    { prs: { ...prs(), pull_requests: prs().pull_requests.map((r, i) =>
      i === 0 ? { ...r, html_url: 'javascript:alert(1)' } : r) } },
  ];
  for (const item of invalid) assert.throws(() => createPublicSampleExport(input(item)));
});

test('F-01: CSV neutralizes formula prefixes, hidden control characters and doubles quotation marks', () => {
  assert.equal(safeCsvCell('=SUM(1,2)'), "\"'=SUM(1,2)\"");
  assert.equal(safeCsvCell('  =HYPERLINK("a","b")'), "\"'  =HYPERLINK(\"\"a\"\",\"\"b\"\")\"");
  assert.equal(safeCsvCell('+cmd'), "\"'+cmd\"");
  assert.equal(safeCsvCell('-2+3'), "\"'-2+3\"");
  assert.equal(safeCsvCell('@SUM(1,1)'), "\"'@SUM(1,1)\"");
  assert.equal(safeCsvCell('\t=1+2'), "\"' =1+2\"");
  assert.equal(safeCsvCell('\u202e=ATTACK'), "\"' =ATTACK\"");
  assert.equal(safeCsvCell('A\r\nB'), '"A  B"');
  assert.equal(safeCsvCell('a"b'), '"a""b"');
  assert.equal(safeCsvCell(null), '""');
});

test('F-01: CSV includes source metadata rows even for an empty filtered selection', () => {
  const snap = createPublicSampleExport(input({
    workflowFilter: 'success', pullFilter: 'draft',
  }));
  const csv = serializePublicSampleCsv(snap);
  const lines = csv.trimEnd().split('\r\n');
  assert.equal(lines.length, 4, 'header + Actions metadata + success run + PR metadata');
  assert.match(csv, /"sample_limit","inspected_count","exported_count","applied_filter"/);
  assert.match(csv, /"actions_sample_metadata"/);
  assert.match(csv, /"pr_sample_metadata"/);
  assert.match(csv, /"2026-10-14T10:21:35.000Z"/);
  assert.match(csv, /"2026-10-14T10:22:01.000Z"/);
  assert.match(csv, /"true"/);
  assert.equal((csv.match(/"pull_request"/g) || []).length, 0);
});

test('F-01: hazardous unfiltered source titles never become formula cells or leak extra properties', () => {
  const srcActions = { ...actions(), token: 'DO-NOT-EXPORT-SENTINEL' };
  const snap = createPublicSampleExport(input({ actions: srcActions }));
  const json = JSON.stringify(snap);
  const csv = serializePublicSampleCsv(snap);
  assert.doesNotMatch(json + csv, /DO-NOT-EXPORT-SENTINEL/);
  assert.match(csv, /"'=HYPERLINK\(/);
  assert.match(csv, /"'\+cmd/);
  assert.match(csv, /"' =1\+2"/);
  assert.ok(csv.endsWith('\r\n'));
});

test('F-01: filename is constrained to validated public repo and UTC seconds', () => {
  assert.equal(createSampleFilename(repo, exported, 'csv'),
    'nexus-owner-repository-sample-20261014102201-utc.csv');
  assert.equal(createSampleFilename(repo, exported, 'json'),
    'nexus-owner-repository-sample-20261014102201-utc.json');
  assert.throws(() => createSampleFilename('../foo', exported, 'csv'));
  assert.throws(() => createSampleFilename(repo, 'yesterday', 'csv'));
});

test('F-01: verified zero-row samples still export accurate empty metadata', () => {
  const emptyA = {
    ...actions(), total_matching_runs: 0, inspected_runs: 0,
    successful_runs: 0, failed_runs: 0, pending_runs: 0, other_outcome_runs: 0,
    runs: [],
  };
  const emptyP = {
    ...prs(), inspected_prs: 0, more_open_prs: false,
    conflicts: 0, needs_attention: 0, unknown: 0, pull_requests: [],
  };
  const snap = createPublicSampleExport(input({ actions: emptyA, prs: emptyP }));
  assert.equal(snap.actions.exported_runs, 0);
  assert.equal(snap.pull_requests.exported_prs, 0);
  assert.equal(serializePublicSampleCsv(snap).trimEnd().split('\r\n').length, 3,
    'two source metadata rows plus CSV header');
});
