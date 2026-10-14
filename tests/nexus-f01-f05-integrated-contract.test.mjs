import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizePublicActions } from '../src/lib/github-public-actions.ts';
import { summarizePublicPullRequests } from '../src/lib/nexus-public-prs.ts';
import { recommendInvestigations } from '../src/lib/nexus-recommendations.ts';
import { isPublicActionsSample, isPublicPullSample } from '../src/lib/nexus-panel-validation.ts';
import { createPublicSampleExport, serializePublicSampleCsv } from '../src/lib/nexus-public-sample-export.ts';
import { readRepositoryLink, buildRepositoryShareUrl } from '../src/lib/nexus-repository-link.ts';
import { summarizePublicPrVerification, isPublicPrVerification } from '../src/lib/nexus-pr-evidence.ts';
import { summarizePublicRunEvidence, isPublicRunEvidence } from '../src/lib/nexus-workflow-run-evidence.ts';
import { summarizePublicWorkflowTrend, isPublicWorkflowTrend } from '../src/lib/nexus-workflow-trends.ts';

const repo = 'owner/example';
const another = 'owner/different';
const receipt = '2026-10-14T01:00:00.000Z';
const stamp = '2026-10-13T12:00:00Z';
const sha = 'a'.repeat(40);

const githubRun = (id, status, conclusion, name='CI') => ({
  id, name, event:'push',status,conclusion, created_at:stamp,
  html_url:'https://github.com/'+repo+'/actions/runs/'+id,
});
const githubPr = (number, title) => ({
  number,title,draft:false,updated_at:stamp,user:{login:'contributor'},
  html_url:'https://github.com/'+repo+'/pull/'+number,
});
const prDetail = (number,mergeable_state) => ({
  number,mergeable_state,mergeable:mergeable_state!=='dirty',
  html_url:'https://github.com/'+repo+'/pull/'+number,
});
const actions = () => summarizePublicActions(repo,{
  total_count:29,workflow_runs:[
    githubRun(91,'completed','failure','=HYPERLINK("https://attacker.invalid","click")'),
    githubRun(92,'completed','success','Build'),
    githubRun(93,'queued',null,'Queued'),
  ],
});
const pulls = () => summarizePublicPullRequests(repo,[
  githubPr(21,'+cmd|powershell'),githubPr(22,'Needs verification'),
],[prDetail(21,'dirty'),null]);
const sample = (override={}) => ({
  repository:repo,actions:actions(),prs:pulls(),
  actionsReceivedAt:receipt,prsReceivedAt:receipt,
  exportedAt:'2026-10-14T01:10:00.000Z',
  workflowFilter:'failed',pullFilter:'conflict', ...override,
});

test('integrated F-01/F-02: validated sources, explanations and filtered export retain identical source IDs',()=>{
 const a=actions(),p=pulls();
 assert.ok(isPublicActionsSample(a,repo));
 assert.ok(isPublicPullSample(p,repo));
 assert.equal(a.inspected_runs,3);
 assert.equal(p.inspected_prs,2);
 const recommendations=recommendInvestigations(a,p);
 assert.deepEqual(recommendations.map(x=>x.key),['pr-21','run-91','pr-22']);
 assert.deepEqual(recommendations.map(x=>x.severity),['high','high','info']);
 assert.equal(recommendations[0].url,'https://github.com/'+repo+'/pull/21');
 assert.match(recommendations[2].severityReason,/no actual blocker can be inferred/i);
 const snapshot=createPublicSampleExport(sample());
 assert.equal(snapshot.actions.inspected_runs,3);
 assert.equal(snapshot.actions.exported_runs,1);
 assert.equal(snapshot.pull_requests.inspected_prs,2);
 assert.equal(snapshot.pull_requests.exported_prs,1);
 assert.deepEqual(snapshot.actions.records.map(x=>x.id),[91]);
 assert.deepEqual(snapshot.pull_requests.records.map(x=>x.number),[21]);
 const csv=serializePublicSampleCsv(snapshot);
 assert.match(csv,/"'=HYPERLINK\(/);
 assert.match(csv,/"'\+cmd\|powershell"/);
 assert.doesNotMatch(csv,/Queued/);
 assert.match(csv,/actions_sample_metadata/);
 assert.match(csv,/pr_sample_metadata/);
 assert.equal(snapshot.data_source,'public-github-rest');
});

test('integrated F-03: a share link changes only public repository; previous samples cannot be reused',()=>{
 const shared=buildRepositoryShareUrl('https://nexus.example/?api_token=remove&repo=old%2Frepo#private',another);
 assert.equal(shared,'https://nexus.example/?repo=owner%2Fdifferent');
 assert.deepEqual(readRepositoryLink(new URL(shared).search),{kind:'valid',repository:another});
 assert.deepEqual(readRepositoryLink('?repo='+encodeURIComponent(repo)+'&repo='+encodeURIComponent(another)),{kind:'invalid'});
 assert.equal(isPublicActionsSample(actions(),another),false);
 assert.equal(isPublicPullSample(pulls(),another),false);
 assert.throws(()=>createPublicSampleExport(sample({repository:another})));
 assert.throws(()=>createPublicSampleExport(sample({actions:actions(),prs:null,repository:another})));
});

test('integrated F-01: partial error exports only verified PR records, not unverified Actions state',()=>{
 const snap=createPublicSampleExport(sample({actions:null,actionsReceivedAt:null,pullFilter:'all'}));
 assert.equal(snap.actions,null);
 assert.equal(snap.pull_requests.records.length,2);
 assert.equal(snap.pull_requests.more_open_prs,false);
 const csv=serializePublicSampleCsv(snap);
 assert.doesNotMatch(csv,/actions_sample_metadata/);
 assert.match(csv,/pr_sample_metadata/);
 assert.match(csv,/"'\+cmd\|powershell"/);
 assert.throws(()=>createPublicSampleExport(sample({actions:null,prs:null,actionsReceivedAt:null,prsReceivedAt:null})));
});

test('integrated F-04: PR and failed workflow detail evidence must match currently selected repository and source IDs',()=>{
 const checks={total_count:1,check_runs:[{id:71,name:'Lint',status:'completed',conclusion:'success'}]};
 const reviews=[{id:81,user:{login:'reviewer'},state:'APPROVED',submitted_at:stamp}];
 const pr=summarizePublicPrVerification(repo,21,{
   number:21,state:'open',html_url:'https://github.com/'+repo+'/pull/21',head:{sha},
 },checks,reviews);
 assert.ok(isPublicPrVerification(pr,repo,21));
 assert.equal(isPublicPrVerification(pr,repo,22),false);
 assert.equal(isPublicPrVerification(pr,another,21),false);
 assert.equal(pr.review_events[0].state,'APPROVED');
 assert.match(pr.scope_note,/historical/i);
 assert.ok(!('is_approved' in pr));
 const sourceRun={...githubRun(91,'completed','failure'),head_sha:sha,run_attempt:2};
 const sourceJobs={total_count:1,jobs:[{id:601,run_id:91,run_attempt:2,name:'Test',
   status:'completed',conclusion:'failure',steps:[{number:1,name:'Execute',status:'completed',conclusion:'failure'}]}]};
 const evidence=summarizePublicRunEvidence(repo,91,sourceRun,sourceJobs);
 assert.ok(isPublicRunEvidence(evidence,repo,91));
 assert.equal(isPublicRunEvidence(evidence,repo,92),false);
 assert.equal(isPublicRunEvidence(evidence,another,91),false);
 assert.equal(evidence.jobs[0].steps[0].conclusion,'failure');
 assert.match(evidence.scope_note,/do not prove root cause/i);
});

test('integrated F-05: only a complete separately requested UTC window may display seven daily records',()=>{
 const now=new Date('2026-10-14T12:00:00.000Z'),end='2026-10-13';
 const recorded=[
  {...githubRun(91,'completed','failure'),created_at:'2026-10-08T12:00:00Z'},
  {...githubRun(92,'completed','success'),created_at:'2026-10-13T18:00:00Z'},
 ];
 const complete=summarizePublicWorkflowTrend(repo,end,{total_count:2,workflow_runs:recorded},now);
 assert.equal(complete.coverage,'complete');
 assert.equal(complete.days.length,7);
 assert.equal(complete.days.reduce((n,day)=>n+day.total,0),2);
 assert.ok(isPublicWorkflowTrend(complete,repo,end,now));
 assert.equal(isPublicWorkflowTrend(complete,another,end,now),false);
 const incomplete=summarizePublicWorkflowTrend(repo,end,{total_count:180,workflow_runs:recorded},now);
 assert.equal(incomplete.coverage,'incomplete');
 assert.deepEqual(incomplete.days,[]);
 assert.ok(isPublicWorkflowTrend(incomplete,repo,end,now));
 assert.equal(isPublicWorkflowTrend({...incomplete,days:complete.days},repo,end,now),false);
});
