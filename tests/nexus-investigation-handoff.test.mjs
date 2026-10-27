import test from 'node:test';
import assert from 'node:assert/strict';
import { createInvestigationHandoff } from '../src/lib/nexus-investigation-handoff.ts';
import { summarizePublicActions } from '../src/lib/github-public-actions.ts';
import { summarizePublicPullRequests } from '../src/lib/nexus-public-prs.ts';

const repository = 'owner/example';
const captured = '2026-10-27T19:15:00.000Z';
const workflow = (id, conclusion = 'failure', name = 'Deploy') => ({
  id, name, event: 'push', status: 'completed', conclusion,
  created_at: captured, html_url: 'https://github.com/' + repository + '/actions/runs/' + id,
});
const pr = (id, title = 'Change') => ({
  number: id, title, draft: false, updated_at: captured,
  html_url: 'https://github.com/' + repository + '/pull/' + id,
});
const details = (id, mergeable_state = 'dirty') => ({
  number: id, html_url: 'https://github.com/' + repository + '/pull/' + id,
  mergeable: mergeable_state !== 'dirty', mergeable_state,
});
const actions = (rows = [workflow(11)]) =>
  summarizePublicActions(repository, { total_count: Math.max(12, rows.length), workflow_runs: rows });
const pulls = (rows = [pr(17)], statuses = [details(17)]) =>
  summarizePublicPullRequests(repository, rows, statuses);
const input = (changes = {}) => ({
  repository, actions: actions(), prs: pulls(),
  actionsReceivedAt: captured, prsReceivedAt: captured,
  workflowFilter: 'all', pullFilter: 'all',
  exportedAt: '2026-10-27T19:20:00.000Z', ...changes,
});

test('Handoff prioritizes verified PR conflict and failed workflow with canonical source links', () => {
  const { filename, markdown } = createInvestigationHandoff(input());
  assert.match(filename, /investigation-handoff\.md$/);
  assert.ok(markdown.indexOf('/pull/17') < markdown.indexOf('/actions/runs/11'));
  assert.match(markdown, /https:\/\/github\.com\/owner\/example\/pull\/17/);
  assert.match(markdown, /https:\/\/github\.com\/owner\/example\/actions\/runs\/11/);
  assert.match(markdown, /Inspected workflows: 1 of 12/);
  assert.match(markdown, /Next manual verification:/);
  assert.match(markdown, /not incident root-cause proof/);
  assert.match(markdown, /No GitHub writes, retries, deployments, new API GETs/);
  assert.equal(markdown, createInvestigationHandoff(input()).markdown);
});

test('Queue handoff uses all previously inspected verified rows, regardless of visual filters', () => {
  const record = input({ workflowFilter: 'success', pullFilter: 'clean' });
  const md = createInvestigationHandoff(record).markdown;
  assert.match(md, /https:\/\/github\.com\/owner\/example\/pull\/17/);
  assert.match(md, /https:\/\/github\.com\/owner\/example\/actions\/runs\/11/);
  assert.match(md, /Visual filters: ignored/);
});

test('Missing source is explicitly labelled and never assumed healthy', () => {
  const report = createInvestigationHandoff(input({actions: null, actionsReceivedAt: null}));
  assert.match(report.markdown, /Actions: UNAVAILABLE \/ UNVERIFIED/);
  assert.match(report.markdown, /PR #17/);
  const noPr = createInvestigationHandoff(input({prs: null, prsReceivedAt: null}));
  assert.match(noPr.markdown, /Pull requests: UNAVAILABLE \/ UNVERIFIED/);
  assert.match(noPr.markdown, /Actions run #11/);
});

test('No observed alerts is not a clean CI or merge-ready verdict', () => {
  const okActions = actions([workflow(11, 'success')]);
  const okPulls = pulls([pr(17)], [details(17, 'clean')]);
  const md = createInvestigationHandoff(input({actions: okActions, prs: okPulls})).markdown;
  assert.match(md, /not.*clean-CI, no-risk or merge-ready verdict/);
  assert.doesNotMatch(md, /HIGH \/ TRIAGE/);
});

test('Triage capped at five and does not invent uninspected source records', () => {
  const runs = Array.from({length: 10}, (_, index) => workflow(101+index));
  const md = createInvestigationHandoff(input({actions:actions(runs),prs:null,prsReceivedAt:null})).markdown;
  const matches = [...md.matchAll(/HIGH \/ TRIAGE/g)];
  assert.equal(matches.length, 5);
  assert.match(md, /actions\/runs\/101/);
  assert.doesNotMatch(md, /actions\/runs\/106/);
});

test('Untrusted GitHub titles cannot inject raw HTML, Markdown links or invisible bidi controls', () => {
  const raw = '<img src=x onerror=alert(1)> [click](https://evil.example)\u202e =HYPERLINK(1)';
  const md = createInvestigationHandoff(input({
    actions:actions([workflow(11,'failure',raw)]),
    prs:pulls([pr(17,raw)],[details(17)]),
  })).markdown;
  assert.doesNotMatch(md, /<img/);
  assert.doesNotMatch(md, /(?<!\\)\[click\]\(https:\/\/evil/);
  assert.doesNotMatch(md, /\u202e/);
  assert.match(md, /&lt;img/);
  assert.match(md, /github\.com\/owner\/example\/pull\/17/);
});

test('Refuses invalid or foreign repository, receipt timestamp and unverified sources', () => {
  assert.throws(() => createInvestigationHandoff(input({repository:'foreign/example'})));
  assert.throws(() => createInvestigationHandoff(input({exportedAt:'invalid'})));
  assert.throws(() => createInvestigationHandoff(input({actionsReceivedAt:null})));
  assert.throws(() => createInvestigationHandoff(input({
    actions:null,prs:null,actionsReceivedAt:null,prsReceivedAt:null,
  })));
});
