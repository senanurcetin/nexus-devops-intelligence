import test from 'node:test';
import assert from 'node:assert/strict';
import { readPublicPanel, emptyPanel, formatPublicPanelDiagnosticReport } from '../src/lib/nexus-panel-request.ts';

const signal = () => new AbortController().signal;
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json' },
});

test('panel adapter: successful JSON object retains data without an error', async () => {
  let fetchCount = 0;
  const result = await readPublicPanel('/api/public-actions', signal(), async (_url, init) => {
    fetchCount++;
    assert.equal(init.cache, 'no-store');
    assert.ok(init.signal);
    return json({ repository: 'owner/repo', inspected_runs: 0 });
  });
  assert.equal(fetchCount, 1);
  assert.equal(result.data.repository, 'owner/repo');
  assert.equal(result.error, null);
});

test('panel adapter: 429 WAF HTML is announced as rate limit, not JSON parse failure', async () => {
  const result = await readPublicPanel('/api/public-prs', signal(),
    async () => new Response('<html>Limited</html>', { status: 429 }));
  assert.equal(result.data, null);
  assert.match(result.error, /request limit/i);
  assert.doesNotMatch(result.error, /html|syntax/i);
});

test('panel adapter: restricted public API 404 and 503 errors remain helpful', async () => {
  const missing = await readPublicPanel('/api/public-prs', signal(),
    async () => json({ error: 'Public repository not found.' }, 404));
  assert.equal(missing.error, 'Public repository not found.');
  const upstream = await readPublicPanel('/api/public-prs', signal(),
    async () => json({ error: 'GitHub API is currently unavailable.' }, 503));
  assert.equal(upstream.error, 'GitHub API is currently unavailable.');
});

test('panel adapter: malformed and non-JSON payloads fail without leaking server markup', async () => {
  const responses = [
    new Response('<b>private error</b>', { status: 503 }),
    new Response('{', { status: 200 }),
    json([1, 2, 3]),
    json({ error: '' }, 500),
  ];
  for (const response of responses) {
    const result = await readPublicPanel('/api/public-actions', signal(), async () => response);
    assert.equal(result.data, null);
    assert.equal(typeof result.error, 'string');
    assert.doesNotMatch(result.error, /private error|<b>/);
  }
});

test('panel adapter: network failure is safe and aborted request stays silent', async () => {
  const ctl = new AbortController();
  const unavailable = await readPublicPanel('/api/public-actions', ctl.signal,
    async () => { throw new Error('private upstream IP and token'); });
  assert.equal(unavailable.data, null);
  assert.match(unavailable.error, /Network request failed/);
  assert.doesNotMatch(unavailable.error, /token|private/);
  ctl.abort();
  const aborted = await readPublicPanel('/api/public-actions', ctl.signal,
    async () => { throw new Error('aborted'); });
  assert.deepEqual(aborted, emptyPanel());
});

test('panel adapter: server-supplied oversized errors are not displayed', async () => {
  const result = await readPublicPanel('/api/public-actions', signal(),
    async () => json({ error: 's'.repeat(400) }, 502));
  assert.equal(result.data, null);
  assert.ok(result.error.length < 300);
});

test('panel adapter: displays bounded WAF Retry-After guidance without auto-retry', async () => {
  let calls = 0;
  const result = await readPublicPanel('/api/public-actions', signal(), async () => {
    calls++;
    return new Response('<html>WAF blocked</html>', { status: 429, headers: { 'Retry-After': '42' } });
  });
  assert.equal(calls, 1);
  assert.equal(result.data, null);
  assert.match(result.error, /wait at least 42 seconds/i);
  assert.doesNotMatch(result.error, /WAF blocked|html/i);
});

test('panel adapter: ignores malformed and oversized WAF Retry-After hints', async () => {
  for (const value of ['9999999', 'date unavailable', '-8']) {
    const result = await readPublicPanel('/api/public-prs', signal(), async () =>
      new Response('Rate limit', { status: 429, headers: { 'Retry-After': value } }));
    assert.match(result.error, /try again shortly/i);
    assert.doesNotMatch(result.error, /9999999|unavailable|-8/);
  }
});

test('panel receipt reports only allowlisted metadata from existing successful HTTP response', async () => {
  let requests = 0;
  const result = await readPublicPanel('/api/public-actions', signal(), async (_url, init) => {
    requests++;
    assert.equal(init.cache, 'no-store');
    return new Response(JSON.stringify({repository:'owner/repo'}),{
      status:200,headers:{
        'content-type':'application/json',
        'x-vercel-cache':'MISS',
        'x-nexus-rate-limit-mode':'shared-redis',
        'set-cookie':'session=very-private-token',
        'x-nexus-rate-limit-source':'evil-secret',
      },
    });
  });
  assert.equal(requests,1);
  assert.deepEqual(result.receipt,{
    status:200,cache:'MISS',admission:'shared-redis',limitSource:'not reported',
  });
  assert.doesNotMatch(JSON.stringify(result.receipt),/session|private|cookie|evil-secret/);
});

test('panel receipt uses stable allowlist for forged CDN and rate headers', async () => {
  for(const bad of ['<script>alert(1)</script>','MISS token appended','1234567',
    'shared-redis, local-fallback','Bearer secret']) {
    const result = await readPublicPanel('/api/public-prs',signal(),async()=>
      new Response(JSON.stringify({repository:'owner/repo'}),{
        status:200, headers:{
          'content-type':'application/json','x-vercel-cache':bad,
          'x-nexus-rate-limit-mode':bad,
          'x-nexus-rate-limit-source':bad,
        },
      }));
    assert.deepEqual(result.receipt,{
      status:200,cache:'not reported',
      admission:'not reported',limitSource:'not reported',
    });
    assert.doesNotMatch(JSON.stringify(result.receipt),/script|Secret|secret|Bearer/);
  }
});

test('panel diagnostics preserve safe 429 and 503 observations without raw payloads', async () => {
  const limited = await readPublicPanel('/api/public-actions',signal(),async()=>new Response(
    '<h1>private WAF error</h1>',{status:429,headers:{
      'retry-after':'10','x-vercel-cache':'BYPASS',
      'x-nexus-rate-limit-source':'shared-redis',
    }}));
  assert.equal(limited.receipt?.status,429);
  assert.equal(limited.receipt?.cache,'BYPASS');
  assert.equal(limited.receipt?.limitSource,'shared-redis');
  assert.doesNotMatch(JSON.stringify(limited),/private WAF error/);
  const unavailable = await readPublicPanel('/api/public-prs',signal(),async()=>
    new Response('private transport data',{status:503,headers:{
      'x-nexus-rate-limit-source':'shared-redis-unavailable',
      'x-vercel-cache':'STALE',
    }}));
  assert.equal(unavailable.receipt?.status,503);
  assert.equal(unavailable.receipt?.cache,'STALE');
  assert.equal(unavailable.receipt?.limitSource,'shared-redis-unavailable');
  assert.doesNotMatch(JSON.stringify(unavailable),/private transport data/);
});

test('panel abort and network exception never claim a received HTTP status', async () => {
  const ctl=new AbortController();
  ctl.abort();
  const cancelled=await readPublicPanel('/api/public-prs',ctl.signal,async()=>{throw Error('abort');});
  assert.deepEqual(cancelled,emptyPanel());
  const broken=await readPublicPanel('/api/public-prs',signal(),async()=>{throw Error('secret local network');});
  assert.equal(broken.receipt,undefined);
});

test('copyable G04 receipt report contains only allowlisted metadata and no secrets',async()=>{
  const response = new Response('private-token-must-never-appear',{status:503,headers:{
    'x-vercel-cache':'BYPASS',
    'x-nexus-rate-limit-source':'shared-redis-unavailable',
    'authorization':'Bearer secret-token',
    'set-cookie':'session=secret-cookie',
    'x-dangerous-header':'private-attribution-data',
  }});
  const out=await readPublicPanel('/api/public-actions',signal(),async()=>response);
  const report=formatPublicPanelDiagnosticReport(out.receipt,undefined);
  assert.match(report,/Actions: HTTP 503 \| CDN BYPASS/);
  assert.match(report,/PRs: no HTTP response observed/);
  assert.match(report,/0 API requests/);
  assert.match(report,/Not proof of SSO/);
  assert.doesNotMatch(report,/private-token|Bearer|secret-cookie|private-attribution|example\.com|set-cookie/);
});

test('copyable receipt report has fixed lines and no user-supplied URL, query or raw payload',()=>{
  const s=formatPublicPanelDiagnosticReport({
    status:429,cache:'MISS',admission:'not reported',limitSource:'shared-redis',
  },{
    status:200,cache:'HIT',admission:'shared-redis',limitSource:'not reported',
  });
  assert.equal(s.split('\n').length,5);
  assert.match(s,/Actions: HTTP 429/);
  assert.match(s,/PRs: HTTP 200/);
  assert.equal(s.includes('https://'),false);
  assert.equal(s.includes('Bearer'),false);
});

test('copyable receipt report without completed HTTP does not invent statuses',()=>{
  const s=formatPublicPanelDiagnosticReport();
  assert.match(s,/Actions: no HTTP response observed/);
  assert.match(s,/PRs: no HTTP response observed/);
  assert.doesNotMatch(s,/HTTP 200|HTTP 429|verified|passed/i);
});
