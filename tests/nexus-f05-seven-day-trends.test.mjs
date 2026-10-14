import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  trendWindow, summarizePublicWorkflowTrend, isPublicWorkflowTrend,
} from '../src/lib/nexus-workflow-trends.ts';
import { loadPublicWorkflowTrend } from '../src/lib/github-public-workflow-trends.ts';
import { GET } from '../src/app/api/public-workflow-trends/route.ts';
import { readFileSync } from 'node:fs';

const repo='owner/example',now=new Date('2026-10-14T08:30:00.000Z'),end='2026-10-13';
const base='https://api.github.com/repos/'+repo+'/actions/runs';
const run=(id,day,status,conclusion)=>({
 id,created_at:day+'T14:30:00Z',status,conclusion,
 html_url:'https://github.com/'+repo+'/actions/runs/'+id,
});
const rows=[
 run(1,'2026-10-07','completed','success'),
 run(2,'2026-10-07','completed','failure'),
 run(3,'2026-10-10','queued',null),
 run(4,'2026-10-13','completed','cancelled'),
 run(5,'2026-10-13','completed','timed_out'),
];
const payload={total_count:5,workflow_runs:rows};
const result=(body,status=200,headers={})=>Response.json(body,{status,headers});

test('F-05: exact last seven completed UTC days and strict 30-complete-day ceiling',()=>{
 const w=trendWindow(end,now);
 assert.deepEqual({start:w.start_utc,end:w.end_utc},{start:'2026-10-07',end});
 assert.equal(w.end_exclusive_ms-w.start_ms,7*86400000);
 assert.equal(trendWindow('2026-09-14',now).end_utc,'2026-09-14');
 for(const bad of ['2026-10-14','2026-10-15','2026-09-13','2026-02-30',
  '2026-10-13T00:00:00Z','../../token','2026-1-3','']) {
  assert.throws(()=>trendWindow(bad,now),Error,bad);
 }
});

test('F-05: all five runs counted by creation date and API outcome, including nonfailure cancellation',()=>{
 const snap=summarizePublicWorkflowTrend(repo,end,payload,now);
 assert.equal(snap.coverage,'complete');
 assert.equal(snap.total_matching_runs,5);
 assert.equal(snap.inspected_runs,5);
 assert.equal(snap.days.length,7);
 assert.deepEqual(snap.days[0],{day_utc:'2026-10-07',success:1,failed:1,pending:0,other:0,total:2});
 assert.deepEqual(snap.days[1],{day_utc:'2026-10-08',success:0,failed:0,pending:0,other:0,total:0});
 assert.equal(snap.days[3].pending,1);
 assert.equal(snap.days[6].failed,1);
 assert.equal(snap.days[6].other,1);
 assert.match(snap.scope_note,/not historical daily final CI results/);
 assert.equal(isPublicWorkflowTrend(snap,repo,end,now),true);
 assert.equal(isPublicWorkflowTrend(snap,repo,'2026-10-12',now),false);
});

test('F-05: an incomplete 100-row page never creates a daily chart or inferred denominator',()=>{
 const full=Array.from({length:100},(_,i)=>run(i+1,'2026-10-09','completed','success'));
 const partial=summarizePublicWorkflowTrend(repo,end,{total_count:305,workflow_runs:full},now);
 assert.equal(partial.coverage,'incomplete');
 assert.equal(partial.total_matching_runs,305);
 assert.equal(partial.inspected_runs,100);
 assert.deepEqual(partial.days,[]);
 assert.equal(isPublicWorkflowTrend(partial,repo,end,now),true);
 assert.match(partial.scope_note,/deliberately suppressed/);
 const short=summarizePublicWorkflowTrend(repo,end,{total_count:5,workflow_runs:[rows[0]]},now);
 assert.equal(short.coverage,'incomplete');
 assert.deepEqual(short.days,[]);
});

test('F-05: zero runs legitimately returns seven zero-count UTC days',()=>{
 const data=summarizePublicWorkflowTrend(repo,end,{total_count:0,workflow_runs:[]},now);
 assert.equal(data.coverage,'complete');
 assert.equal(data.days.length,7);
 assert.equal(data.days.every(d=>d.total===0),true);
 assert.equal(isPublicWorkflowTrend(data,repo,end,now),true);
});

test('F-05: reject inconsistent, malformed, duplicate, untrusted or outside-date source data',()=>{
 const cases=[
  {total_count:1,workflow_runs:rows},
  {total_count:-1,workflow_runs:[]},
  {total_count:101,workflow_runs:Array.from({length:101},(_,i)=>run(i+1,'2026-10-10','completed','success'))},
  {total_count:2,workflow_runs:[rows[0],rows[0]]},
  {total_count:1,workflow_runs:[{...rows[0],html_url:'https://attacker.example/collect'}]},
  {total_count:1,workflow_runs:[run(10,'2026-10-06','completed','success')]},
  {total_count:1,workflow_runs:[run(10,'2026-10-14','completed','success')]},
  {total_count:1,workflow_runs:[{...rows[0],created_at:'2026-10-07T02:00:00-02:00'}]},
  {total_count:1,workflow_runs:[{...rows[0],status:'x'.repeat(200)}]},
 ];
 for(const bad of cases)assert.throws(()=>summarizePublicWorkflowTrend(repo,end,bad,now));
 const good=summarizePublicWorkflowTrend(repo,end,payload,now);
 assert.equal(isPublicWorkflowTrend({...good,days:good.days.map((d,i)=>i===0?{...d,failed:9}:d)},repo,end,now),false);
 assert.equal(isPublicWorkflowTrend({...good,total_matching_runs:6},repo,end,now),false);
 assert.equal(isPublicWorkflowTrend({...good,repository:'evil/repo'},repo,end,now),false);
});

test('F-05: one fixed-host GitHub GET, 100 max per page, exact created window',async()=>{
 const urls=[];const response=await loadPublicWorkflowTrend(repo,end,async(url,init)=>{
  urls.push(String(url));
  assert.equal(init.headers['User-Agent'],'nexus-devops-intelligence-public-preview');
  assert.equal(init.next.revalidate,120);
  return result(payload);
 },now);
 assert.equal(response.status,200);
 assert.equal(urls.length,1);
 const parsed=new URL(urls[0]);
 assert.equal(parsed.origin,'https://api.github.com');
 assert.equal(parsed.pathname,'/repos/owner/example/actions/runs');
 assert.equal(parsed.searchParams.get('created'),'2026-10-07T00:00:00Z..2026-10-13T23:59:59Z');
 assert.equal(parsed.searchParams.get('per_page'),'100');
 assert.equal(parsed.searchParams.get('page'),'1');
 assert.equal(response.body.coverage,'complete');
});

test('F-05: rate limiting or invalid GitHub payload stops without any retry or partial trend',async()=>{
 let calls=0;
 const limit=await loadPublicWorkflowTrend(repo,end,async()=>{calls++;return result({private:'upstream'},429,{'Retry-After':'51'})},now);
 assert.equal(limit.status,429);
 assert.equal(limit.retryAfterSeconds,51);
 assert.equal(calls,1);
 assert.doesNotMatch(JSON.stringify(limit.body),/upstream/);
 const failed=await loadPublicWorkflowTrend(repo,end,async()=>{calls++;return result({total_count:1,workflow_runs:[rows[0],rows[0]]})},now);
 assert.equal(failed.status,502);
 assert.equal(calls,2);
 assert.equal('days' in failed.body,false);
});

test('F-05: invalid route params perform zero GitHub or Redis work',async()=>{
 const old=globalThis.fetch;
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected network call')};
 const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
 const pastDay=new Date(Date.now()-45*86400000).toISOString().slice(0,10);
 const invalid=[
  'repository=owner%2Fexample',
  'repository=owner%2Fexample&end='+yesterday+'&end='+yesterday,
  'repository=owner%2Fexample&repository=evil%2Frepo&end='+yesterday,
  'repository=bad&end='+yesterday,
  'repository=owner%2Fexample&end=2200-01-01',
  'repository=owner%2Fexample&end='+pastDay,
  'repository=owner%2Fexample&end='+yesterday+'&secret=abc',
 ];
 try{
  for(const q of invalid){
   const request=new NextRequest('http://localhost:3000/api/public-workflow-trends?'+q);
   const res=await GET(request);
   assert.equal(res.status,400,q);
   assert.equal(res.headers.get('cache-control'),'no-store');
  }
  assert.equal(calls,0);
 }finally{globalThis.fetch=old;}
});

test('F-05: synthetic Redis admission once, then 429 blocks GitHub with zero real Upstash',async()=>{
 const old={fetch:globalThis.fetch,vercel:process.env.VERCEL,url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN};
 const fake='https://f05-test-only.upstash.io',yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
 process.env.VERCEL='1';process.env.UPSTASH_REDIS_REST_URL=fake;process.env.UPSTASH_REDIS_REST_TOKEN='test-fixture-not-real';
 let allow=true;const calls={redis:0,github:0};
 globalThis.fetch=async(url,init)=>{
  const u=String(url);
  if(u===fake){calls.redis++;assert.equal(init.method,'POST');assert.equal(JSON.parse(init.body)[0],'EVAL');return result({result:[allow?1:21,53]});}
  calls.github++;
  return result({total_count:0,workflow_runs:[]});
 };
 try{
  const request=new NextRequest('http://localhost:3000/api/public-workflow-trends?repository=owner%2Fexample&end='+yesterday,{headers:{'x-vercel-forwarded-for':'198.51.100.197'}});
  const ok=await GET(request);
  assert.equal(ok.status,200);
  assert.equal(ok.headers.get('x-nexus-rate-limit-mode'),'shared-redis');
  assert.equal(calls.redis,1);
  assert.equal(calls.github,1);
  allow=false;
  const limit=await GET(request);
  assert.equal(limit.status,429);
  assert.equal(limit.headers.get('x-nexus-rate-limit-source'),'shared-redis');
  assert.equal(calls.redis,2);
  assert.equal(calls.github,1);
 }finally{
  globalThis.fetch=old.fetch;
  for(const [key,value] of [['VERCEL',old.vercel],['UPSTASH_REDIS_REST_URL',old.url],['UPSTASH_REDIS_REST_TOKEN',old.token]]) {
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
});

test('F-05: client only loads trend on user action and suppresses incomplete coverage chart',()=>{
 const page=readFileSync('src/app/page.tsx','utf8');
 assert.ok(page.includes('onClick={inspectUtcTrend}'));
 assert.ok(page.includes('function inspectUtcTrend()'));
 assert.ok(page.includes("trendController.current?.abort()"));
 assert.ok(page.includes("setTrend(emptyPanel())"));
 assert.ok(page.includes("trend.data.coverage === 'complete'"));
 assert.ok(page.includes('No chart or inferred'));
 assert.ok(page.includes('new Date(Date.now() - 86_400_000)'));
});
