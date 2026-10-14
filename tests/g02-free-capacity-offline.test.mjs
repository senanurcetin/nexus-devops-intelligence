import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {screenCapacity} from '../scripts/check-free-capacity-offline.mjs';

const fixtureNow = new Date('2026-10-14T12:00:00Z');
const usage = (override = {}) => ({
  'observed-at-utc': '2026-10-14T11:00:00Z',
  'upstash-monthly-commands': 1000,
  'upstash-data-mb': 20,
  'upstash-bandwidth-gb': 1,
  'vercel-invocations': 10000,
  'vercel-active-cpu-hours': 0.8,
  'vercel-provisioned-memory-gb-hours': 23,
  'planned-origin-requests': 100,
  ...override,
});
const cli = fileURLToPath(new URL('../scripts/check-free-capacity-offline.mjs', import.meta.url));
const toArgs = obj => Object.entries(obj).flatMap(([key,value]) => ['--'+key,String(value)]);
const invoke = args => spawnSync(process.execPath,[cli,...args],{
  encoding:'utf8',timeout:6500,env:{...process.env,
    UPSTASH_REDIS_REST_TOKEN:'must-never-be-touched-or-printed',
    UPSTASH_REDIS_REST_URL:'https://secret.example.invalid',
  },
});

test('G02 missing dashboard usage is INCOMPLETE, never a Free capacity PASS',()=>{
  const result=screenCapacity({},fixtureNow);
  assert.equal(result.status,'INCOMPLETE');
  assert.equal(result.missing.length,8);
  assert.equal('metrics' in result,false);
  const cmd=invoke(['--json']);
  assert.equal(cmd.status,2);
  assert.equal(JSON.parse(cmd.stdout).status,'INCOMPLETE');
  assert.doesNotMatch(cmd.stdout+cmd.stderr,/must-never-be-touched-or-printed|secret\.example/);
});

test('G02 calculations keep separate shared Redis and TEAM Vercel ceilings',()=>{
  const result=screenCapacity(usage(),fixtureNow);
  assert.equal(result.status,'READY_FOR_OWNER_REVIEW');
  assert.equal(result.planning.assumedAdditionalRedisCommands,400);
  assert.equal(result.metrics[0].projected,1400);
  assert.equal(result.metrics[0].reviewCeiling,400000);
  assert.equal(result.metrics[3].projected,10100);
  assert.equal(result.metrics[3].reviewCeiling,800000);
  assert.ok(result.warnings.some(x=>x.includes('not a verified billing measurement')));
});

test('G02 missing future requests is INCOMPLETE even when usage values exist',()=>{
  const input=usage();
  delete input['planned-origin-requests'];
  const result=screenCapacity(input,fixtureNow);
  assert.equal(result.status,'INCOMPLETE');
});

test('G02 48h freshness, future observations and crossed UTC month cannot pass',()=>{
  for (const timestamp of ['2026-10-12T11:59:59Z','2026-10-14T12:01:01Z',
    '2026-09-30T23:59:59Z','not-utc']) {
    assert.equal(screenCapacity(usage({'observed-at-utc':timestamp}),fixtureNow).status,
      'INCOMPLETE',timestamp);
  }
});

test('G02 consumed shared monthly commands plus conservative planned 4x cannot exceed 80% review ceiling',()=>{
  assert.equal(screenCapacity(usage({
    'upstash-monthly-commands':399601,'planned-origin-requests':100,
  }),fixtureNow).status,'HOLD');
  assert.equal(screenCapacity(usage({
    'upstash-monthly-commands':399600,'planned-origin-requests':100,
  }),fixtureNow).status,'READY_FOR_OWNER_REVIEW');
});

test('G02 owner screenshot 250 MB storage cap enforces 200 MB engineering reserve',()=>{
  const justAt=screenCapacity(usage({'upstash-data-mb':200}),fixtureNow);
  const above=screenCapacity(usage({'upstash-data-mb':200.01}),fixtureNow);
  assert.equal(justAt.status,'READY_FOR_OWNER_REVIEW');
  assert.equal(justAt.metrics[1].limit,250);
  assert.equal(justAt.metrics[1].reviewCeiling,200);
  assert.equal(above.status,'HOLD');
});

test('G02 high Upstash data or bandwidth independently forces HOLD',()=>{
  for (const [key,value] of [['upstash-data-mb',205],
    ['upstash-bandwidth-gb',8.01]]) {
    const result=screenCapacity(usage({[key]:value}),fixtureNow);
    assert.equal(result.status,'HOLD',key);
    assert.equal(result.metrics.filter(x=>!x.withinConservativeReviewCeiling).length,1);
  }
});

test('G02 Hobby aggregate invocations, CPU and memory each independently force HOLD',()=>{
  for (const [key,value] of [['vercel-invocations',799901],
    ['vercel-active-cpu-hours',3.21],
    ['vercel-provisioned-memory-gb-hours',289]]) {
    const result=screenCapacity(usage({[key]:value}),fixtureNow);
    assert.equal(result.status,'HOLD',key);
  }
});

test('G02 huge forecast cannot overflow JS-safe integer math into acceptance',()=>{
  const result=screenCapacity(usage({'planned-origin-requests':Number.MAX_SAFE_INTEGER}),fixtureNow);
  assert.equal(result.status,'INCOMPLETE');
});

test('G02 offline CLI rejects repeated, negative, unknown, credential-looking and malformed values',()=>{
  for (const args of [
    ['--upstash-monthly-commands','-1'],
    ['--upstash-data-mb','NaN'],
    ['--upstash-data-mb','1e5'],
    ['--upstash-data-mb','1.2.3'],
    ['--upstash-monthly-commands','1','--upstash-monthly-commands','2'],
    ['--UPSTASH_REDIS_REST_TOKEN','private'],
    ['--observed-at-utc','tomorrow'],
  ]) {
    const result=invoke(args);
    assert.equal(result.status,2,args.join(' '));
    assert.match(result.stderr,/G-02 INVALID INPUT/);
    assert.doesNotMatch(result.stdout+result.stderr,/must-never-be-touched-or-printed/);
  }
});

test('G02 CLI readable output is review-only and does not emit environment secrets',()=>{
  const valid={...usage(), 'observed-at-utc':new Date().toISOString().replace(/\.\d{3}Z$/,'Z')};
  const r=invoke([...toArgs(valid),'--json']);
  assert.equal(r.status,0,r.stderr);
  const o=JSON.parse(r.stdout);
  assert.equal(o.status,'READY_FOR_OWNER_REVIEW');
  assert.equal(o.planning.assumedAdditionalRedisCommands,400);
  assert.doesNotMatch(r.stdout,/must-never-be-touched-or-printed|secret\.example/);
  const source=readFileSync(cli,'utf8');
  assert.doesNotMatch(source,/\bfetch\s*\(|\bhttps?\s*\.\s*request\s*\(|\bprocess\.env\b/);
});
