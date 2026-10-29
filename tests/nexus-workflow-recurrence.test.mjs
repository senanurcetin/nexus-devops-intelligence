import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicSampleExport } from '../src/lib/nexus-public-sample-export.ts';
import { createAuditBrief } from '../src/lib/nexus-audit-brief.ts';
import {
  analyzeWorkflowRecurrence, describeRecurrenceSignal, MIN_REPEATED_FAILURES, RECURRENCE_SCOPE_NOTE,
} from '../src/lib/nexus-workflow-recurrence.ts';

const repo = 'owner/repository';
const url = id => 'https://github.com/' + repo + '/actions/runs/' + id;
// minutesAgo: larger = older, so the list below reads "newest first" when ids/ages are chosen that way.
const run = (id, name, conclusion, minutesAgo, status = 'completed') => ({
  id, name, status, conclusion, event: 'push',
  created_at: new Date(Date.UTC(2026, 9, 15, 10, 0) - minutesAgo * 60_000).toISOString(),
  html_url: url(id),
});

test('Recurrence: an ongoing failure streak is reported with the newest failed run', () => {
  const rows = analyzeWorkflowRecurrence([
    run(5, 'Build', 'failure', 1), run(4, 'Build', 'timed_out', 2),
    run(3, 'Build', 'success', 3), run(2, 'Build', 'failure', 4),
  ]);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.signal, 'ongoing_failure_streak');
  assert.equal(row.latest_failure_streak, 2);
  assert.equal(row.confirmed_failures, 3);
  assert.equal(row.decisive_runs, 4);
  assert.equal(row.latest_failure_url, url(5));
  assert.ok(row.earliest_failure_created_at < row.latest_failure_created_at);
});

test('Recurrence: recovered and mixed cases are distinguished from an ongoing streak', () => {
  const recovered = analyzeWorkflowRecurrence([
    run(4, 'Deploy', 'success', 1), run(3, 'Deploy', 'failure', 2), run(2, 'Deploy', 'failure', 3),
  ]);
  assert.equal(recovered[0].signal, 'repeated_failure_recovered');
  assert.equal(recovered[0].latest_decisive_outcome, 'success');
  const mixed = analyzeWorkflowRecurrence([
    run(4, 'Lint', 'failure', 1), run(3, 'Lint', 'success', 2), run(2, 'Lint', 'failure', 3),
  ]);
  assert.equal(mixed[0].signal, 'repeated_failure_mixed');
  assert.equal(mixed[0].latest_failure_streak, 1);
});

test('Recurrence: a single failure, success-only workflows and empty samples report nothing', () => {
  assert.equal(MIN_REPEATED_FAILURES, 2);
  assert.deepEqual(analyzeWorkflowRecurrence([]), []);
  assert.deepEqual(analyzeWorkflowRecurrence([run(1, 'A', 'failure', 1), run(2, 'A', 'success', 2)]), []);
  assert.deepEqual(analyzeWorkflowRecurrence([run(1, 'A', 'success', 1), run(2, 'A', 'success', 2)]), []);
});

test('Recurrence: cancelled, skipped, neutral and unfinished runs never extend or break a streak', () => {
  const rows = analyzeWorkflowRecurrence([
    run(6, 'Test', null, 1, 'in_progress'), run(5, 'Test', 'failure', 2),
    run(4, 'Test', 'cancelled', 3), run(3, 'Test', 'skipped', 4),
    run(2, 'Test', 'failure', 5), run(1, 'Test', 'neutral', 6),
  ]);
  assert.equal(rows[0].signal, 'ongoing_failure_streak');
  assert.equal(rows[0].latest_failure_streak, 2);
  assert.equal(rows[0].decisive_runs, 2);
  assert.equal(rows[0].ignored_runs, 4);
});

test('Recurrence: runs of different workflows are never merged and ordering is deterministic', () => {
  const input = [
    run(1, 'Alpha', 'failure', 1), run(2, 'Alpha', 'failure', 2),
    run(3, 'Beta', 'failure', 3), run(4, 'Beta', 'failure', 4), run(5, 'Beta', 'failure', 5),
    run(6, 'Gamma', 'success', 1), run(7, 'Gamma', 'failure', 2), run(8, 'Gamma', 'failure', 3),
  ];
  const snapshot = JSON.stringify(input);
  const rows = analyzeWorkflowRecurrence(input);
  assert.equal(JSON.stringify(input), snapshot, 'input must not be mutated');
  assert.deepEqual(rows.map(r => r.workflow), ['Beta', 'Alpha', 'Gamma']);
  assert.deepEqual(analyzeWorkflowRecurrence([...input].reverse()), rows, 'input order must not matter');
});

test('Recurrence: identical timestamps fall back to the larger run id', () => {
  const same = run(9, 'Tie', 'failure', 1);
  const rows = analyzeWorkflowRecurrence([
    { ...same, id: 11, html_url: url(11) },
    { ...same, id: 12, html_url: url(12), conclusion: 'success' },
    { ...same, id: 8, html_url: url(8) },
  ]);
  // same instant: the largest id (12) counts as newest and succeeded => failures 11 and 8 are "recovered"
  assert.equal(rows[0].signal, 'repeated_failure_recovered');
  assert.equal(rows[0].latest_failure_url, url(11));
});

test('Recurrence: hostile or oversized input is rejected, never guessed', () => {
  assert.throws(() => analyzeWorkflowRecurrence('nope'), /must be an array/);
  assert.throws(() => analyzeWorkflowRecurrence([{ id: 1.5, name: 'x', status: 'completed', conclusion: 'failure',
    created_at: 'nonsense', html_url: url(1) }]), /Invalid workflow record/);
  assert.throws(() => analyzeWorkflowRecurrence(Array.from({ length: 11 }, (_, i) => run(i + 1, 'X', 'failure', i))),
    /bounded limit/);
  assert.equal(analyzeWorkflowRecurrence([run(1, '  ', 'failure', 1), run(2, '', 'failure', 2)])[0].workflow,
    '(unnamed workflow)');
});

test('Recurrence: wording never claims root cause, flake rate or approval', () => {
  for (const signal of ['ongoing_failure_streak', 'repeated_failure_mixed', 'repeated_failure_recovered']) {
    assert.doesNotMatch(describeRecurrenceSignal(signal), /flak|root cause|approve|safe to/i);
  }
  assert.match(RECURRENCE_SCOPE_NOTE, /not a failure rate, root cause, flake diagnosis or merge\/retry approval/);
});

const sampleActions = runs => ({
  repository: repo, total_matching_runs: 50, inspected_runs: runs.length,
  successful_runs: 0, failed_runs: runs.length, pending_runs: 0, other_outcome_runs: 0,
  scope_note: 'Recent sample only', runs,
});
const briefFor = (runs, workflowFilter = 'all') => createAuditBrief(createPublicSampleExport({
  repository: repo, actions: sampleActions(runs), prs: null,
  actionsReceivedAt: '2026-10-15T10:20:00.000Z', prsReceivedAt: null,
  workflowFilter, pullFilter: 'all', exportedAt: '2026-10-15T10:24:00.000Z',
}));

test('Evidence Brief: shows a bounded, source-linked repeated-failure section only when there is one', () => {
  const none = briefFor([run(1, 'Build', 'failure', 1)]);
  assert.doesNotMatch(none, /Repeated failure signals/);

  const text = briefFor([run(3, 'Build', 'failure', 1), run(2, 'Build', 'failure', 2), run(1, 'Build', 'success', 3)]);
  assert.match(text, /#### Repeated failure signals \(sample-bound\)/);
  assert.match(text, /Build: 2 confirmed failures in 3 decisive runs \(0 ignored/);
  assert.match(text, /the most recent decisive runs all failed/);
  assert.match(text, /\[Latest failed run\]\(https:\/\/github\.com\/owner\/repository\/actions\/runs\/3\)/);
  assert.match(text, /not a failure rate, root cause, flake diagnosis or merge\/retry approval/);
  assert.match(text, /Decision:\*\* Not established by this bounded sample/);
});

test('Evidence Brief: workflow names cannot inject Markdown, HTML or link syntax into the signal line', () => {
  const evil = 'x](https://evil.example)<script>alert(1)</script>\u202e';
  const text = briefFor([run(2, evil, 'failure', 1), run(1, evil, 'failure', 2)]);
  const line = text.split('\n').find(l => l.includes('confirmed failures in'));
  assert.ok(line, 'signal line present');
  assert.doesNotMatch(line, /<script>|https:\/\/evil\.example|\u202e/);
  assert.equal((line.match(/\]\(/g) ?? []).length, 1, 'only the generated source link remains');
});

test('Evidence Brief: recurrence is computed only from exported rows, so a success filter reports nothing', () => {
  const runs = [run(3, 'Build', 'failure', 1), run(2, 'Build', 'failure', 2), run(1, 'Build', 'success', 3)];
  assert.doesNotMatch(briefFor(runs, 'success'), /Repeated failure signals/);
});

// ---- Investigation Handoff (also the markdown carried by the Jarvis digest) ----
import { createInvestigationHandoff } from '../src/lib/nexus-investigation-handoff.ts';
import { summarizePublicActions } from '../src/lib/github-public-actions.ts';
import { createJarvisMcpHandler } from '../src/lib/nexus-jarvis-mcp.ts';

const handoffFor = (runs, workflowFilter = 'all') => createInvestigationHandoff({
  repository: repo, actions: sampleActions(runs), prs: null,
  actionsReceivedAt: '2026-10-15T10:20:00.000Z', prsReceivedAt: null,
  workflowFilter, pullFilter: 'all', exportedAt: '2026-10-15T10:24:00.000Z',
}).markdown;

test('Investigation Handoff: repeated-failure section appears only with 2+ confirmed failures and ignores visual filters', () => {
  assert.doesNotMatch(handoffFor([run(1, 'Build', 'failure', 1)]), /Repeated failure signals/);
  const runs = [run(3, 'Build', 'failure', 1), run(2, 'Build', 'failure', 2), run(1, 'Build', 'success', 3)];
  for (const filter of ['all', 'success']) {
    const text = handoffFor(runs, filter);
    assert.match(text, /## Repeated failure signals \(sample-bound\)/, 'filter ' + filter);
    assert.match(text, /Build: 2 confirmed failures in 3 decisive runs/);
    assert.match(text, /\[Latest failed run\]\(https:\/\/github\.com\/owner\/repository\/actions\/runs\/3\)/);
    assert.match(text, /## Checks before any engineering action/);
  }
});

test('Investigation Handoff: hostile workflow names cannot inject links or HTML', () => {
  const evil = 'x](https://evil.example)<img src=x onerror=alert(1)>';
  const line = handoffFor([run(2, evil, 'failure', 1), run(1, evil, 'failure', 2)])
    .split('\n').find(l => l.includes('confirmed failures in'));
  assert.ok(line);
  assert.doesNotMatch(line, /<img|https:\/\/evil\.example/);
  assert.equal((line.match(/\]\(/g) ?? []).length, 1);
});

test('Jarvis digest carries the repeated-failure section in handoff_markdown without any schema change', async () => {
  const jrepo = 'owner/example';
  const at = m => new Date(Date.UTC(2026, 9, 29, 20, 40) - m * 60_000).toISOString();
  const jrun = (id, conclusion, m) => ({
    id, name: 'Deploy', event: 'push', status: 'completed', conclusion, created_at: at(m),
    html_url: 'https://github.com/' + jrepo + '/actions/runs/' + id,
  });
  const body = summarizePublicActions(jrepo, {
    total_count: 12, workflow_runs: [jrun(13, 'failure', 1), jrun(12, 'failure', 2), jrun(11, 'success', 3)],
  });
  const handle = createJarvisMcpHandler({
    now: () => new Date('2026-10-29T20:50:00.000Z'),
    fetchImpl: async (u) => new Response(
      new URL(u).pathname === '/api/public-actions' ? JSON.stringify(body) : '{"error":"x"}',
      { status: new URL(u).pathname === '/api/public-actions' ? 200 : 404, headers: { 'content-type': 'application/json' } }),
  });
  const response = await handle({ jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'devops_repo_digest', arguments: { repository: jrepo } } });
  const digest = JSON.parse(response.result.content[0].text);
  assert.equal(digest.schema, 'nexus.devops.jarvis-digest/v1');
  assert.match(digest.handoff_markdown, /Repeated failure signals \(sample-bound\)/);
  assert.match(digest.handoff_markdown, /Deploy: 2 confirmed failures in 3 decisive runs/);
  assert.equal(digest.access.release_authorized, false);
  assert.equal(digest.access.merge_approval, false);
  assert.ok(!('workflow_recurrence' in digest), 'no new top-level field: the pinned v1 shape is unchanged');
});
