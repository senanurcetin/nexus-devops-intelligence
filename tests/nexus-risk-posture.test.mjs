import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRepositoryRiskPosture } from '../src/lib/nexus-risk-posture.ts';
import { summarizePublicActions } from '../src/lib/github-public-actions.ts';
import { summarizePublicPullRequests } from '../src/lib/nexus-public-prs.ts';

const repository='owner/example';
const received='2026-10-28T08:10:00.000Z';
const asOf=new Date('2026-10-28T08:15:00.000Z');
const run=(id,conclusion='failure')=>({
  id,name:'CI',event:'push',status:'completed',conclusion,created_at:received,
  html_url:'https://github.com/'+repository+'/actions/runs/'+id,
});
const pr=(id,draft=false)=>({
  number:id,title:'Change '+id,draft,updated_at:received,
  html_url:'https://github.com/'+repository+'/pull/'+id,
});
const details=(id,state='clean')=>({
  number:id,html_url:'https://github.com/'+repository+'/pull/'+id,
  mergeable_state:state,mergeable:state!=='dirty',
});
const actions=(list=[run(9)],total=list.length)=>summarizePublicActions(repository,{
  total_count:total, workflow_runs:list,
});
const prs=(list=[pr(2)],states=[details(2)],more=false)=>
  summarizePublicPullRequests(repository,
    [...list,...(more?[pr(99)]:[])],states);
const inspect=(changes={})=>assessRepositoryRiskPosture({
  repository, actions:actions(),pulls:prs(),actionsReceivedAt:received,
  prsReceivedAt:received,asOf,...changes,
});

test('Strong observed signals have distinct source-backed counts without global risk score',()=>{
 const out=inspect({actions:actions([run(9,'timed_out')],600),
  pulls:prs([pr(2)],[details(2,'dirty')],true)});
 assert.equal(out.state,'investigate_observed');
 assert.equal(out.workflow.failed,1);
 assert.equal(out.workflow.inspected,1);
 assert.equal(out.workflow.uninspected,599);
 assert.equal(out.workflow.truncated,true);
 assert.equal(out.pullRequests.conflicts,1);
 assert.equal(out.pullRequests.moreOpenMayExist,true);
 assert.equal(out.coverage,'both');
 assert.equal(out.releaseAuthorized,false);
 assert.equal('score' in out,false);
 assert.match(out.evidenceLimitations.join(' | '),/Additional workflow runs/);
});
test('PR merge restrictions and unknown states request human review, not confirmed CI failure',()=>{
 const p=prs([pr(1),pr(2),pr(3)],
   [details(1,'blocked'),details(2,'behind'),null]);
 const out=inspect({actions:actions([run(3,'success')]),pulls:p});
 assert.equal(out.state,'review_observed');
 assert.equal(out.workflow.failed,0);
 assert.equal(out.pullRequests.reviewStates,2);
 assert.equal(out.pullRequests.unknown,1);
 assert.equal(out.pullRequests.conflicts,0);
});
test('Clean samples still do not imply merge readiness, coverage or release permission',()=>{
 const a=actions([run(4,'success')],45);
 const out=inspect({actions:a,pulls:prs([pr(7)],[details(7,'clean')])});
 assert.equal(out.state,'no_confirmed_signal');
 assert.equal(out.workflow.uninspected,44);
 assert.equal(out.releaseAuthorized,false);
 assert.match(out.evidenceLimitations.join(' '),/No branch-protection/);
});
test('Missing independent source never becomes a pass or a fabricated empty scope',()=>{
 const onlyPr=inspect({actions:null, actionsReceivedAt:null});
 assert.equal(onlyPr.coverage,'prs_only');
 assert.equal(onlyPr.state,'no_confirmed_signal');
 assert.equal(onlyPr.workflow.freshness,'unverified');
 const onlyActions=inspect({pulls:null, prsReceivedAt:null});
 assert.equal(onlyActions.coverage,'actions_only');
 assert.equal(onlyActions.pullRequests.freshness,'unverified');
 const noData=inspect({actions:null, pulls:null,actionsReceivedAt:null,prsReceivedAt:null});
 assert.equal(noData.coverage,'none');
 assert.equal(noData.state,'await_evidence');
 assert.equal(noData.releaseAuthorized,false);
});
test('Expired observations yield refresh status when there are no fresher signals',()=>{
 const past='2026-10-28T06:10:00.000Z';
 const x=inspect({actionsReceivedAt:past,prsReceivedAt:past,
   actions:actions([run(9,'failure')]),
   pulls:prs([pr(2)],[details(2,'dirty')])});
 assert.equal(x.state,'refresh_before_decision');
 assert.equal(x.workflow.failed,1);
 assert.equal(x.pullRequests.conflicts,1);
 assert.equal(x.workflow.freshness,'stale');
 assert.equal(x.releaseAuthorized,false);
});
test('Fresh observed failures remain actionable even if other source is stale',()=>{
 const out=inspect({prsReceivedAt:'2026-10-28T06:10:00.000Z'});
 assert.equal(out.state,'investigate_observed');
 assert.equal(out.pullRequests.freshness,'stale');
 assert.match(out.evidenceLimitations.join(' '),/older than 30 minutes/);
});
test('At exactly 30 minutes receipt is fresh; later it becomes stale',()=>{
 const atEdge=new Date('2026-10-28T08:40:00.000Z');
 const fresh=inspect({asOf:atEdge,actions:actions([]),pulls:prs([],[])});
 assert.equal(fresh.workflow.freshness,'recent');
 const stale=inspect({asOf:new Date(atEdge.getTime()+1),actions:actions([]),pulls:prs([],[])});
 assert.equal(stale.workflow.freshness,'stale');
});
test('Malformed, future or missing receipt suppresses that source rather than inventing zero findings',()=>{
 for(const t of ['2026-02-31T10:00:00.000Z','2026-10-28', '2026-10-28T12:00:00.000Z',null]){
  const x=inspect({actionsReceivedAt:t});
  assert.equal(x.workflow.freshness,'unverified');
  assert.equal(x.coverage,'prs_only');
 }
});
test('Cross-repository and forged payload totals cannot contribute to risk',()=>{
 const forged=structuredClone(actions());
 forged.failed_runs=123;
 const noActions=inspect({actions:forged});
 assert.equal(noActions.workflow.freshness,'unverified');
 assert.equal(noActions.workflow.failed,0);
 const other=inspect({repository:'foreign/repo'});
 assert.equal(other.coverage,'none');
 assert.equal(other.state,'await_evidence');
});
test('Cancellation and in-progress runs never count as observed failures',()=>{
 const a=actions([{...run(9,'failure'),status:'in_progress'},run(10,'cancelled')]);
 const out=inspect({actions:a,pulls:prs([],[])});
 assert.equal(out.workflow.failed,0);
 assert.equal(out.state,'no_confirmed_signal');
});
