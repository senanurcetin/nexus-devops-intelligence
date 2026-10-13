import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendInvestigations } from '../src/lib/nexus-recommendations.ts';
import { summarizePublicPullRequests } from '../src/lib/nexus-public-prs.ts';
import { summarizePublicActions } from '../src/lib/github-public-actions.ts';
import { readFileSync } from 'node:fs';

const repo='owner/example',stamp='2026-10-14T00:00:00Z';
const p=n=>({number:n,title:'Change '+n,draft:false,updated_at:stamp,html_url:'https://github.com/'+repo+'/pull/'+n});
const d=(n,state)=>({number:n,mergeable_state:state,mergeable:state!=='dirty',html_url:'https://github.com/'+repo+'/pull/'+n});
const w=(n,result,status='completed')=>({id:n,name:'CI',event:'push',status,conclusion:result,created_at:stamp,html_url:'https://github.com/'+repo+'/actions/runs/'+n});

test('F-02: each GitHub PR merge status explains severity, provenance and non-speculative next step',()=>{
 const source=summarizePublicPullRequests(repo,[p(1),p(2),p(3),p(4),p(5)],
   [d(1,'dirty'),d(2,'blocked'),d(3,'unstable'),d(4,'behind'),null]);
 const records=recommendInvestigations(null,source);
 assert.deepEqual(records.map(r=>r.key),['pr-1','pr-2','pr-3','pr-4','pr-5']);
 assert.deepEqual(records.map(r=>r.severity),['high','medium','medium','medium','info']);
 for(const item of records){
   assert.equal(item.sourceType,'pull_request');
   assert.match(item.sourceLabel,/^PR #\d+$/);
   assert.match(item.url,/^https:\/\/github\.com\/owner\/example\/pull\/\d+$/);
   assert.ok(item.reportedSignal.length>8);
   assert.ok(item.severityReason.length>20);
   assert.ok(item.nextStep.length>20);
 }
 assert.match(records[4].severityReason,/no actual blocker can be inferred/i);
 assert.match(records[1].severityReason,/has not been fetched/i);
 assert.match(records[2].severityReason,/does not identify a specific failing check/i);
 assert.match(records[3].severityReason,/does not establish a failed CI run/i);
});

test('F-02: confirmed workflow failures give source links and no invented root causes',()=>{
 const source=summarizePublicActions(repo,{total_count:5,workflow_runs:[
   w(11,'failure'),w(12,'timed_out'),w(13,'startup_failure'),
   w(14,'cancelled'),w(15,'failure','in_progress')]});
 const records=recommendInvestigations(source,null);
 assert.deepEqual(records.map(r=>r.key),['run-11','run-12','run-13']);
 for(const item of records){
   assert.equal(item.sourceType,'workflow_run');
   assert.equal(item.severity,'high');
   assert.match(item.sourceLabel,/^Actions run #\d+$/);
   assert.match(item.reportedSignal,/GitHub conclusion:/);
   assert.match(item.severityReason,/underlying cause is not known/i);
   assert.match(item.nextStep,/original GitHub Actions run/);
 }
});

test('F-02: reject mutated unsafe source deep links before rendering copyable items',()=>{
 const a=summarizePublicActions(repo,{total_count:1,workflow_runs:[w(9,'failure')]});
 const prs=summarizePublicPullRequests(repo,[p(1)],[d(1,'dirty')]);
 a.runs[0].html_url='https://attacker.invalid/collect';
 prs.pull_requests[0].html_url='javascript:alert(1)';
 assert.deepEqual(recommendInvestigations(a,prs),[]);
});

test('F-02: unknown is informational; sort high first with five-item cap',()=>{
 const prs=summarizePublicPullRequests(repo,[p(1),p(2),p(3),p(4),p(5)],
 [null,d(2,'behind'),d(3,'blocked'),d(4,'unstable'),d(5,'dirty')]);
 const a=summarizePublicActions(repo,{total_count:3,workflow_runs:[w(90,'failure'),w(91,'timed_out'),w(92,'startup_failure')]});
 const list=recommendInvestigations(a,prs);
 assert.deepEqual(list.map(x=>x.key),['pr-5','run-90','run-91','run-92','pr-2']);
 assert.deepEqual(list,recommendInvestigations(a,prs));
 assert.equal(list.length,5);
 const onlyUnknown=recommendInvestigations(null,summarizePublicPullRequests(repo,[p(1)],[null]));
 assert.equal(onlyUnknown[0].severity,'info');
});

test('F-02: accessible clipboard feedback and original source links do not issue a fallback request',()=>{
 const page=readFileSync('src/app/page.tsx','utf8');
 assert.ok(page.includes('if (!navigator.clipboard?.writeText)'));
 assert.ok(page.includes('await navigator.clipboard.writeText(url)'));
 assert.ok(page.includes("Copy GitHub link for ' + item.sourceLabel"));
 assert.ok(page.includes('role="status" aria-live="polite"'));
 assert.ok(page.includes('Clipboard unavailable. Use Review source'));
 assert.ok(page.includes('href={item.url}'));
 assert.ok(!page.includes('document.execCommand('));
});
