import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  summarizePublicPrVerification, isPublicPrVerification, parsePublicPrNumber,
} from '../src/lib/nexus-pr-evidence.ts';
import { loadPublicPrVerification } from '../src/lib/github-public-pr-evidence.ts';
import { GET } from '../src/app/api/public-pr-verification/route.ts';

const repo='owner/example',number=21,sha='a'.repeat(40);
const base='https://api.github.com/repos/'+repo;
const pull={number,html_url:'https://github.com/'+repo+'/pull/'+number,state:'open',head:{sha}};
const checks={total_count:2,check_runs:[
  {id:71,name:'lint',status:'completed',conclusion:'success'},
  {id:72,name:'integration',status:'in_progress',conclusion:null},
]};
const reviews=[{id:100,user:{login:'reviewer1'},state:'APPROVED',submitted_at:'2026-10-13T14:00:00Z'},
{id:101,user:{login:'reviewer1'},state:'DISMISSED',submitted_at:'2026-10-13T16:00:00Z'}];
const response=(body,status=200,headers={})=>Response.json(body,{status,headers});
function fetcher(calls,override={}) {
  return async (url,init)=>{
    const u=String(url);calls.push(u);
    assert.equal(init.headers['User-Agent'],'nexus-devops-intelligence-public-preview');
    assert.equal(init.next.revalidate,120);
    assert.match(u,/^https:\/\/api\.github\.com\/repos\/owner\/example\//);
    if(u===base+'/pulls/21')return response(override.pull??pull);
    if(u===base+'/commits/'+sha+'/check-runs?per_page=30&page=1')return response(override.checks??checks);
    if(u===base+'/pulls/21/reviews?per_page=30&page=1')return response(override.reviews??reviews);
    throw Error('unexpected Github request: '+u);
  };
}
const request=(query='repository=owner%2Fexample&number=21')=>new NextRequest(
  'http://localhost:3000/api/public-pr-verification?'+query,
  {headers:{'x-vercel-forwarded-for':'198.51.100.51'}},
);
async function offlineGitHub(fn) {
  const old=globalThis.fetch;
  const calls=[];
  globalThis.fetch=fetcher(calls);
  try{return await fn(calls);}finally{globalThis.fetch=old;}
}

test('F-04: valid explicitly requested PR uses exactly 3 sequential public GETs and preserves events',async()=>{
 const calls=[];const result=await loadPublicPrVerification(repo,number,fetcher(calls));
 assert.equal(result.status,200);
 assert.deepEqual(calls,[
  base+'/pulls/21',
  base+'/commits/'+sha+'/check-runs?per_page=30&page=1',
  base+'/pulls/21/reviews?per_page=30&page=1',
 ]);
 const x=result.body;
 assert.equal(x.number,number);
 assert.equal(x.head_sha,sha);
 assert.equal(x.inspected_check_runs,2);
 assert.equal(x.total_check_runs,2);
 assert.equal(x.inspected_review_events,2);
 assert.deepEqual(x.review_events.map(v=>v.state),['APPROVED','DISMISSED']);
 assert.match(x.scope_note,/historical/);
 assert.match(x.scope_note,/may be superseded/);
 assert.equal(isPublicPrVerification(x,repo,number),true);
 assert.equal(isPublicPrVerification(x,repo,22),false);
});

test('F-04: PR mismatch/closed/missing head fails before check or review fanout',async()=>{
 for(const broken of [
  {...pull,state:'closed'}, {...pull,number:22}, {...pull,html_url:'https://malicious.invalid/secret'},
  {...pull,head:{sha:'../unsafe'}}, {...pull,head:null},
 ]) {
  const calls=[];
  const result=await loadPublicPrVerification(repo,number,fetcher(calls,{pull:broken}));
  assert.equal(result.status,502);
  assert.equal(calls.length,1);
  assert.doesNotMatch(JSON.stringify(result.body),/malicious|unsafe/i);
 }
});

test('F-04: invalid numbers, malformed inputs and duplicate query parameters cause 400 and ZERO GitHub/Redis calls',async()=>{
 const inputs=[
  'repository=owner%2Fexample&number=0','repository=owner%2Fexample&number=-1',
  'repository=owner%2Fexample&number=21.4','repository=owner%2Fexample&number=21&number=22',
  'repository=owner%2Fexample&repository=evil%2Frepo&number=21',
  'repository=owner%2Fexample&number=99999999999',
  'repository=invalid&number=21','repository=owner%2Fexample&number=21&token=secret',
 ];
 await offlineGitHub(async calls=>{
  for(const q of inputs){
    const result=await GET(request(q));
    assert.equal(result.status,400,q);
    assert.equal(result.headers.get('cache-control'),'no-store');
    assert.equal(calls.length,0);
  }
 });
 for(const x of ['0','-3','21.1','99999999999']) assert.throws(()=>parsePublicPrNumber(x));
});

test('F-04: downstream check 429 prevents reviews GET, preserves bounded Retry-After without leaking Github data',async()=>{
 const calls=[];const f=async(u,init)=>{
  calls.push(String(u));
  return String(u)===base+'/pulls/21' ? response(pull) :
    response({message:'upstream private detail'},429,{'Retry-After':'55'});
 };
 const result=await loadPublicPrVerification(repo,number,f);
 assert.equal(result.status,429);
 assert.equal(result.retryAfterSeconds,55);
 assert.equal(calls.length,2);
 assert.doesNotMatch(JSON.stringify(result.body),/upstream private/);
});

test('F-04: reviews quota failure is 429 and no successful subset is fabricated',async()=>{
 const calls=[];const f=async u=>{
  calls.push(String(u));
  if(calls.length===1)return response(pull);
  if(calls.length===2)return response(checks);
  return response({message:'internal token details'},403,{'x-ratelimit-remaining':'0'});
 };
 const result=await loadPublicPrVerification(repo,number,f);
 assert.equal(result.status,429);
 assert.equal(calls.length,3);
 assert.equal('check_runs' in result.body,false);
 assert.doesNotMatch(JSON.stringify(result.body),/internal token/);
});

test('F-04: malformed checks stop before third request; malformed reviews never imply approval',async()=>{
 const calls=[];const res=await loadPublicPrVerification(repo,number,fetcher(calls,{checks:{check_runs:[]}}));
 assert.equal(res.status,502);
 assert.equal(calls.length,2);
 const malformedCheckCalls=[];
 const malformedChecks=await loadPublicPrVerification(repo,number,fetcher(malformedCheckCalls,{
   checks:{total_count:1,check_runs:[{id:1,name:'check',status:'completed',conclusion:'success'},{id:2,name:'extra',status:'completed',conclusion:'success'}]},
 }));
 assert.equal(malformedChecks.status,502);
 assert.equal(malformedCheckCalls.length,2,'inconsistent totals cannot cause third review GET');
 const invalidReviews=[{id:2,user:{login:'reviewer'},state:'APPROVED',submitted_at:'not-a-date'}];
 const c2=[];const r2=await loadPublicPrVerification(repo,number,fetcher(c2,{reviews:invalidReviews}));
 assert.equal(r2.status,502);
 assert.equal(c2.length,3);
});

test('F-04: bounded samples never synthesize a current approval; duplicate identifiers are rejected',()=>{
 const many=Array.from({length:30},(_,i)=>({...reviews[0],id:i+200}));
 const data=summarizePublicPrVerification(repo,number,pull,{total_count:46,check_runs:checks.check_runs},many);
 assert.equal(data.total_check_runs,46);
 assert.equal(data.inspected_check_runs,2);
 assert.equal(data.inspected_review_events,30);
 assert.equal(data.more_review_events_may_exist,true);
 assert.equal('is_approved' in data,false);
 assert.throws(()=>summarizePublicPrVerification(repo,number,pull,checks,[reviews[0],reviews[0]]));
 assert.throws(()=>summarizePublicPrVerification(repo,number,pull,
  {...checks,check_runs:[checks.check_runs[0],checks.check_runs[0]]},reviews));
});

test('F-04: shared Redis admission is one decision per explicitly requested PR and blocked 429 avoids GitHub',async()=>{
 const previous={fetch:globalThis.fetch,vercel:process.env.VERCEL,url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN};
 const fakeRedis='https://f04-test-only.upstash.io',token='local-only-fixture-not-a-secret';
 process.env.VERCEL='1';process.env.UPSTASH_REDIS_REST_URL=fakeRedis;process.env.UPSTASH_REDIS_REST_TOKEN=token;
 const calls={redis:[],github:[]};let permit=true;
 globalThis.fetch=async(url,init)=>{
  const u=String(url);
  if(u===fakeRedis){
    assert.equal(init.method,'POST');assert.equal(init.headers.Authorization,'Bearer '+token);
    const cmd=JSON.parse(init.body);assert.equal(cmd[0],'EVAL');calls.redis.push(cmd);
    return response({result:[permit?1:21,48]});
  }
  calls.github.push(u);
  return fetcher([])(u,init);
 };
 try{
  const ok=await GET(request());
  assert.equal(ok.status,200);
  assert.equal(ok.headers.get('x-nexus-rate-limit-mode'),'shared-redis');
  assert.equal(calls.redis.length,1);
  assert.equal(calls.github.length,3);
  assert.equal((await ok.json()).inspected_check_runs,2);
  permit=false;
  const limited=await GET(request());
  assert.equal(limited.status,429);
  assert.equal(limited.headers.get('x-nexus-rate-limit-source'),'shared-redis');
  assert.equal(calls.redis.length,2);
  assert.equal(calls.github.length,3);
 }finally{
  globalThis.fetch=previous.fetch;
  for(const [key,val] of [['VERCEL',previous.vercel],['UPSTASH_REDIS_REST_URL',previous.url],['UPSTASH_REDIS_REST_TOKEN',previous.token]]){
   if(val===undefined)delete process.env[key];else process.env[key]=val;
  }
 }
});
