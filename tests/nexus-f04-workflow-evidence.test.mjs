import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  parsePublicRunId, summarizePublicRunEvidence, isPublicRunEvidence,
} from '../src/lib/nexus-workflow-run-evidence.ts';
import { loadPublicWorkflowRunEvidence } from '../src/lib/github-public-workflow-evidence.ts';
import { GET } from '../src/app/api/public-workflow-evidence/route.ts';
import { readFileSync } from 'node:fs';

const repo='owner/example',id=91,sha='a'.repeat(40);
const prefix='https://api.github.com/repos/'+repo+'/actions/runs/'+id;
const run={id,html_url:'https://github.com/'+repo+'/actions/runs/'+id,
  status:'completed',conclusion:'failure',run_attempt:2,head_sha:sha};
const job={id:601,run_id:id,run_attempt:2,name:'Integration test',
  status:'completed',conclusion:'failure',
  steps:[
    {number:1,name:'Checkout',status:'completed',conclusion:'success'},
    {number:2,name:'Test suite',status:'completed',conclusion:'failure'},
  ]};
const jobs={total_count:2,jobs:[job,
  {...job,id:602,name:'Lint',conclusion:'success',
    steps:[{number:1,name:'Lint check',status:'completed',conclusion:'success'}]}]};
const response=(body,status=200,headers={})=>Response.json(body,{status,headers});
function fetcher(calls,replace={}) {
 return async(url,init)=>{
  const u=String(url);calls.push(u);
  assert.equal(init.headers['User-Agent'],'nexus-devops-intelligence-public-preview');
  assert.equal(init.next.revalidate,120);
  if(u===prefix)return response(replace.run??run);
  if(u===prefix+'/attempts/2/jobs?per_page=20&page=1')return response(replace.jobs??jobs);
  throw Error('unexpected source: '+u);
 };
}
const req=(q='repository=owner%2Fexample&id=91')=>new NextRequest(
  'http://localhost:3000/api/public-workflow-evidence?'+q,
  {headers:{'x-vercel-forwarded-for':'198.51.100.123'}},
);

test('F-04 phase 2: explicit failed run costs exactly two GitHub GETs for a specific attempt',async()=>{
 const calls=[];const x=await loadPublicWorkflowRunEvidence(repo,id,fetcher(calls));
 assert.equal(x.status,200);
 assert.deepEqual(calls,[prefix,prefix+'/attempts/2/jobs?per_page=20&page=1']);
 assert.equal(x.body.head_sha,sha);
 assert.equal(x.body.run_attempt,2);
 assert.equal(x.body.inspected_jobs,2);
 assert.equal(x.body.total_jobs,2);
 assert.equal(x.body.jobs[0].steps[1].conclusion,'failure');
 assert.equal(x.body.jobs[1].conclusion,'success');
 assert.match(x.body.scope_note,/do not prove root cause/i);
 assert.equal(isPublicRunEvidence(x.body,repo,id),true);
 assert.equal(isPublicRunEvidence(x.body,repo,id+1),false);
 assert.equal(isPublicRunEvidence({...x.body,html_url:'javascript:alert(1)'},repo,id),false);
});

test('F-04 phase 2: run identity/state mismatch stops before jobs API request',async()=>{
 for(const bad of [
  {...run,id:92},{...run,html_url:'https://attacker.invalid/log'},
  {...run,status:'in_progress',conclusion:null},
  {...run,status:'completed',conclusion:'success'},
  {...run,run_attempt:0},{...run,head_sha:'../evil'},
 ]) {
  const calls=[];const x=await loadPublicWorkflowRunEvidence(repo,id,fetcher(calls,{run:bad}));
  assert.equal(x.status,502);
  assert.equal(calls.length,1);
  assert.doesNotMatch(JSON.stringify(x.body),/attacker|evil/i);
 }
});

test('F-04 phase 2: invalid ids and duplicated/extra URL parameters reject with zero GitHub/Redis',async()=>{
 const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('invalid request reached network')};
 try {
  const inputs=[
   'repository=owner%2Fexample&id=0','repository=owner%2Fexample&id=-5',
   'repository=owner%2Fexample&id=1.1','repository=owner%2Fexample&id=91&id=92',
   'repository=owner%2Fexample&repository=evil%2Frepo&id=91',
   'repository=owner%2Fexample&id=999999999999999999',
   'repository=not-a-repo&id=91','repository=owner%2Fexample&id=91&token=private',
  ];
  for(const q of inputs){
   const r=await GET(req(q));
   assert.equal(r.status,400,q);
   assert.equal(r.headers.get('cache-control'),'no-store');
  }
  assert.equal(calls,0);
  for(const x of ['0','-1','1.2','999999999999999999'])assert.throws(()=>parsePublicRunId(x));
 }finally{globalThis.fetch=old;}
});

test('F-04 phase 2: first request 429 stops second request with safe Retry-After',async()=>{
 let calls=0;const x=await loadPublicWorkflowRunEvidence(repo,id,async()=>{calls++;return response({private:'token'},429,{'Retry-After':'43'})});
 assert.equal(x.status,429);
 assert.equal(x.retryAfterSeconds,43);
 assert.equal(calls,1);
 assert.doesNotMatch(JSON.stringify(x.body),/token/);
});

test('F-04 phase 2: second request rate limited never exposes partial jobs',async()=>{
 let calls=0;const x=await loadPublicWorkflowRunEvidence(repo,id,async()=>{
  calls++;return calls===1?response(run):response({private:'secret'},403,{'x-ratelimit-remaining':'0'});
 });
 assert.equal(x.status,429);assert.equal(calls,2);
 assert.equal('jobs' in x.body,false);assert.doesNotMatch(JSON.stringify(x.body),/secret/);
});

test('F-04 phase 2: malformed or cross-run job data cannot become diagnostic proof',async()=>{
 const invalid=[
  {total_count:0,jobs:[job]},
  {total_count:2,jobs:[job,job]},
  {total_count:1,jobs:[{...job,run_id:92}]},
  {total_count:1,jobs:[{...job,run_attempt:1}]},
  {total_count:1,jobs:[{...job,steps:[job.steps[0],job.steps[0]]}]},
 ];
 for(const bad of invalid){
  const calls=[];const x=await loadPublicWorkflowRunEvidence(repo,id,fetcher(calls,{jobs:bad}));
  assert.equal(x.status,502);assert.equal(calls.length,2);
 }
});

test('F-04 phase 2: sample cap and step limit label omitted steps without diagnosis',()=>{
 const many=Array.from({length:20},(_,i)=>({...job,id:600+i,
  steps:Array.from({length:15},(_,k)=>({
   number:k+1,name:'Source step '+(k+1),status:'completed',
   conclusion:k===14?'failure':'success'
  }))}));
 const x=summarizePublicRunEvidence(repo,id,run,{total_count:61,jobs:many});
 assert.equal(x.total_jobs,61);assert.equal(x.inspected_jobs,20);
 assert.equal(x.jobs[0].steps.length,10);
 assert.equal(x.jobs[0].additional_steps_not_shown,true);
 assert.equal(isPublicRunEvidence(x,repo,id),true);
 assert.equal('root_cause' in x,false);
 assert.throws(()=>summarizePublicRunEvidence(repo,id,run,{total_count:21,jobs:[...many,job]}));
});

test('F-04 phase 2: exactly one shared Redis admission; 429 prevents all GitHub calls',async()=>{
 const old={fetch:globalThis.fetch,vercel:process.env.VERCEL,
  url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN};
 const fakeUrl='https://f04-actions-test-only.upstash.io';
 process.env.VERCEL='1';process.env.UPSTASH_REDIS_REST_URL=fakeUrl;
 process.env.UPSTASH_REDIS_REST_TOKEN='fixture-only-no-real-credential';
 const calls={redis:0,github:0};let allow=true;
 globalThis.fetch=async(url,init)=>{
  const u=String(url);
  if(u===fakeUrl){
   calls.redis++;
   assert.equal(init.method,'POST');assert.equal(JSON.parse(init.body)[0],'EVAL');
   return response({result:[allow?1:21,52]});
  }
  calls.github++;return fetcher([])(u,init);
 };
 try{
  const yes=await GET(req());assert.equal(yes.status,200);
  assert.equal(yes.headers.get('x-nexus-rate-limit-mode'),'shared-redis');
  assert.equal((await yes.json()).jobs.length,2);
  assert.equal(calls.redis,1);assert.equal(calls.github,2);
  allow=false;
  const no=await GET(req());assert.equal(no.status,429);
  assert.equal(no.headers.get('x-nexus-rate-limit-source'),'shared-redis');
  assert.equal(calls.redis,2);assert.equal(calls.github,2);
 }finally{
  globalThis.fetch=old.fetch;
  for(const [key,value] of [['VERCEL',old.vercel],['UPSTASH_REDIS_REST_URL',old.url],['UPSTASH_REDIS_REST_TOKEN',old.token]]) {
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
});

test('F-04 phase 2: only explicit user click can trigger client endpoint; no raw logs or polling',()=>{
 const page=readFileSync('src/app/page.tsx','utf8');
 assert.match(page,/onClick=\{\(\) => inspectFailedRun\(run.id\)\}/);
 assert.match(page,/isConfirmedWorkflowFailure\(run.conclusion\)/);
 assert.match(page,/runEvidenceKey === key && runEvidence.data/);
 assert.match(page,/runEvidenceController.current\?\.abort\(\)/);
 assert.match(page,/No logs are downloaded/);
 assert.ok(!page.includes('/logs?'));
});
