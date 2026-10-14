import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  readUpstashManagementUsage, parseUpstashMonthlyUsage,
} from '../scripts/read-upstash-management-capacity.mjs';

const id='3fcbab26-5a87-4d27-a083-d9bf753fb0be';
const email='fixture@example.org',apiKey='sensitive-management-api-key-fixture';
const env={UPSTASH_MANAGEMENT_EMAIL:email,
  UPSTASH_MANAGEMENT_API_KEY:apiKey,
  UPSTASH_MANAGEMENT_DATABASE_ID:id,
  UPSTASH_REDIS_REST_URL:'https://do-not-use.upstash.io',
  UPSTASH_REDIS_REST_TOKEN:'never-touch-redis-rest-token'};
const now=()=>new Date('2026-10-14T12:00:00.000Z');
const meta={database_id:id,type:'free',state:'active',
  endpoint:'private-database-endpoint',password:'private-database-password'};
const stats={total_monthly_requests:1234,total_monthly_bandwidth:2000000000,
  total_monthly_storage:5000000,current_storage:7000000,
  token:'private-json-token-not-for-display'};

function fakeClient(calls, a=meta, b=stats) {
  return async (url,init)=>{
    calls.push({url,init});
    assert.equal(init.method,'GET');
    assert.equal(init.cache,'no-store');
    assert.equal(init.redirect,'error');
    assert.equal(init.headers.Accept,'application/json');
    assert.equal(init.headers.Authorization,
      'Basic '+Buffer.from(email+':'+apiKey,'utf8').toString('base64'));
    assert.equal(new URL(url).origin,'https://api.upstash.com');
    assert.ok(!String(url).includes('do-not-use.upstash.io'));
    const expected=[
      'https://api.upstash.com/v2/redis/database/'+id+'?credentials=hide',
      'https://api.upstash.com/v2/redis/stats/'+id,
    ];
    assert.equal(url,expected[calls.length-1]);
    return Response.json(calls.length===1?a:b);
  };
}

test('R2 absent approval OR absent management access makes zero network calls',async()=>{
  for(const input of [
    {authorized:false,env},
    {authorized:true,env:{}},
    {authorized:true,env:{UPSTASH_REDIS_REST_TOKEN:'redis-not-management'}},
  ]){
    let calls=0;
    const result=await readUpstashManagementUsage({...input,now,
      fetcher:async()=>{calls++;throw Error('unexpected outbound call')}});
    assert.equal(result.status,'INCOMPLETE');
    assert.equal(result.releaseAuthorized,false);
    assert.equal(result.vercelTeamUsageVerified,false);
    assert.equal(calls,0);
  }
});

test('R2 management credentials are only used for two fixed GETs and never printed',async()=>{
  const calls=[];
  const out=await readUpstashManagementUsage({
    authorized:true,env,now,fetcher:fakeClient(calls),
  });
  assert.equal(calls.length,2);
  assert.equal(out.status,'UPSTASH_ONLY_VERIFIED');
  assert.equal(out.upstashPlan,'free');
  assert.equal(out.observedAtUtc,'2026-10-14T12:00:00.000Z');
  assert.deepEqual(out.upstashUsage,{
    'upstash-monthly-commands':1234,
    'upstash-data-mb':7,
    'upstash-bandwidth-gb':2,
  });
  assert.equal(out.vercelTeamUsageVerified,false);
  assert.equal(out.releaseAuthorized,false);
  assert.doesNotMatch(JSON.stringify(out),new RegExp(
    [apiKey,'private-database','private-json-token',
      'never-touch-redis-rest-token','fixture@example'].join('|')));
  assert.ok(out.notes.some(s=>s.includes('Lua EVAL')));
});

test('R2 non-Free or inactive DB stops BEFORE asking for stats',async()=>{
  for(const [type,state] of [['paid','active'],['free','suspended'],
    ['payg','active'],[undefined,'active']]) {
    const calls=[];
    const result=await readUpstashManagementUsage({
      authorized:true,env,now,
      fetcher:fakeClient(calls,{...meta,type,state}),
    });
    assert.equal(result.status,'HOLD');
    assert.equal(calls.length,1);
  }
});

test('R2 unrelated database fails BEFORE second request and never discloses metadata',async()=>{
  const calls=[];
  const result=await readUpstashManagementUsage({
    authorized:true,env,now,
    fetcher:fakeClient(calls,{...meta,database_id:'different-secret-db'}),
  });
  assert.equal(result.status,'INCOMPLETE');
  assert.equal(calls.length,1);
  assert.doesNotMatch(JSON.stringify(result),/different-secret-db/);
});

test('R2 missing or malformed monthly metrics never become implicit zero or PASS',()=>{
  const invalid=[
    null,{},[],{...stats,current_storage:-1},
    {...stats,total_monthly_requests:'1000'},
    {...stats,total_monthly_bandwidth:Infinity},
    {...stats,total_monthly_storage:9007199254740992},
    {...stats,total_monthly_requests:NaN},
    {...stats,total_monthly_bandwidth:null},
  ];
  for(const data of invalid){
    const out=parseUpstashMonthlyUsage(meta,data,id,now().toISOString());
    assert.equal(out.status,'INCOMPLETE',JSON.stringify(data));
  }
});

test('R2 rejects malformed management configuration without network calls',async()=>{
  const invalid=[
    {...env,UPSTASH_MANAGEMENT_DATABASE_ID:'../../admin'},
    {...env,UPSTASH_MANAGEMENT_DATABASE_ID:'https://api.evil.invalid'},
    {...env,UPSTASH_MANAGEMENT_EMAIL:'attacker@example.com:token'},
    {...env,UPSTASH_MANAGEMENT_API_KEY:'x'},
    {...env,UPSTASH_MANAGEMENT_DATABASE_ID:'a'.repeat(500)},
  ];
  for(const input of invalid){
    let calls=0;
    const out=await readUpstashManagementUsage({
      authorized:true,env:input,now,
      fetcher:async()=>{calls++;throw Error('request escaped')},
    });
    assert.equal(out.status,'INCOMPLETE');
    assert.equal(calls,0);
  }
});

test('R2 upstream API error and private error messages are stripped',async()=>{
  for(const bad of [
    async()=>new Response('private-api-key', {status:401}),
    async()=>new Response('secret-stack', {status:500}),
    async()=>new Response('secret-private-json-not-json', {status:200}),
    async()=>{throw Error('sensitive management access token');},
  ]){
    let calls=0;
    const out=await readUpstashManagementUsage({
      authorized:true,env,now,
      fetcher:async()=>{calls++;return bad();},
    });
    assert.equal(out.status,'INCOMPLETE');
    assert.equal(calls,1);
    assert.doesNotMatch(JSON.stringify(out),
      /private-api-key|secret-stack|secret-private|sensitive management/);
  }
});

test('R2 CLI defaults to no-network INCOMPLETE and ignores REDIS REST credentials',()=>{
  const exe=fileURLToPath(new URL('../scripts/read-upstash-management-capacity.mjs',import.meta.url));
  const vars={...process.env,
    UPSTASH_REDIS_REST_TOKEN:'never-print-rest-token',
    UPSTASH_REDIS_REST_URL:'https://fake-only.upstash.io'};
  for(const args of [[],['--authorized-readonly'],['--not-an-option']]){
    const p=spawnSync(process.execPath,[exe,...args],{env:vars,
      encoding:'utf8',timeout:6000});
    assert.equal(p.status,2);
    const o=JSON.parse(p.stdout);
    assert.equal(o.status,'INCOMPLETE');
    assert.equal(o.releaseAuthorized,false);
    assert.doesNotMatch(p.stdout+p.stderr,/never-print-rest-token|fake-only/);
  }
  const help=spawnSync(process.execPath,[exe,'--help'],{env:vars,encoding:'utf8',timeout:6000});
  assert.equal(help.status,0);
  assert.match(help.stdout,/NEVER|Never|never/);
});
