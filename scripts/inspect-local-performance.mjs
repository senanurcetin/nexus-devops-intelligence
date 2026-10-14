#!/usr/bin/env node
/**
 * R11: isolated, CI-free localhost laboratory browser measurement.
 * Every API is fulfilled from source-valid, deterministic fixtures.
 * No GitHub, Redis, Vercel Preview or Production network calls.
 * Only run against an already-built local Next.js server.
 *
 *   NEXUS_BROWSER_BASE_URL=http://127.0.0.1:3057/ npm run perf:local
 *
 * Optional manual-browser dependencies:
 *   npm install --no-save --package-lock=false playwright-core@1.64.0 axe-core@4.11.0
 *
 * These are laboratory browser timings, NEVER field Core Web Vitals.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { summarizePublicActions } from '../src/lib/github-public-actions.ts';
import { summarizePublicPullRequests } from '../src/lib/nexus-public-prs.ts';

const input = new URL(process.env.NEXUS_BROWSER_BASE_URL || 'http://127.0.0.1:3000/');
if (input.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(input.hostname) ||
    input.pathname !== '/' || input.search || input.hash || input.username || input.password) {
  throw Error('R11 laboratory benchmark is loopback-only. Refuse live origins.');
}
const sha = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const repo = 'owner/one';
const origin = input.origin;
const sourceDate = '2026-10-13T12:00:00Z';
const actions = summarizePublicActions(repo,{
  total_count:1,workflow_runs:[{
    id:91,name:'Local fixture CI',event:'push',status:'completed',
    conclusion:'success',created_at:sourceDate,
    html_url:'https://github.com/owner/one/actions/runs/91',
  }],
});
const prs = summarizePublicPullRequests(repo,[{
  number:21,title:'Local fixture PR',draft:false,updated_at:sourceDate,
  user:{login:'fixture-user'},html_url:'https://github.com/owner/one/pull/21',
}], [{number:21,mergeable_state:'clean',mergeable:true,
  html_url:'https://github.com/owner/one/pull/21'}]);

const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const results = [];
try {
  for (const width of [375,1280]) {
    for (let trial = 1; trial <= 3; trial++) {
      const ctx=await browser.newContext({
        viewport:{width,height:900},serviceWorkers:'block',
      });
      const page=await ctx.newPage();
      const pageErrors=[];
      let apiGets=0, externalBlocked=0;
      page.on('pageerror',err=>pageErrors.push(err.name));
      await ctx.addInitScript(() => {
        window.__nexusLab = {lcpMs:null,cls:0};
        try {
          new PerformanceObserver(list=>{
            for(const e of list.getEntries()) window.__nexusLab.lcpMs=e.startTime;
          }).observe({type:'largest-contentful-paint',buffered:true});
        } catch {}
        try {
          new PerformanceObserver(list=>{
            for(const e of list.getEntries()){
              if (!e.hadRecentInput) window.__nexusLab.cls+=e.value;
            }
          }).observe({type:'layout-shift',buffered:true});
        } catch {}
      });
      await page.route('**/*',async route=>{
        const request=route.request(),url=new URL(request.url());
        if (url.origin !== origin) {
          externalBlocked++;
          return route.abort();
        }
        if(!url.pathname.startsWith('/api/'))return route.continue();
        assert.equal(request.method(),'GET');
        assert.deepEqual([...url.searchParams.keys()],['repository']);
        assert.equal(url.searchParams.get('repository'),repo);
        apiGets++;
        if(url.pathname!=='/api/public-actions'&&url.pathname!=='/api/public-prs'){
          throw Error('R11 must never request opt-in API during initial load');
        }
        return route.fulfill({
          status:200,contentType:'application/json',
          headers:{'cache-control':'no-store'},
          body:JSON.stringify(url.pathname.endsWith('actions')?actions:prs),
        });
      });
      try {
        await page.goto(origin+'/?repo=owner%2Fone',{waitUntil:'load'});
        await page.getByText('BOTH SOURCE PANELS LOADED',{exact:true}).waitFor({timeout:14000});
        const responseVisibleMs=await page.evaluate(()=>performance.now());
        await page.waitForTimeout(550);
        const perf=await page.evaluate(()=>{
          const nav=performance.getEntriesByType('navigation')[0];
          const paint=performance.getEntriesByName('first-contentful-paint')[0];
          return {
            fcpMs:paint?.startTime??null,
            lcpMs:window.__nexusLab?.lcpMs??null,
            cls:window.__nexusLab?.cls??null,
            domContentLoadedMs:nav?.domContentLoadedEventEnd??null,
            loadMs:nav?.loadEventEnd??null,
            documentWidth:document.documentElement.scrollWidth,
            viewportWidth:document.documentElement.clientWidth,
          };
        });
        assert.equal(apiGets,2,'only two initial source GETs');
        assert.equal(externalBlocked,0,'no external network');
        assert.deepEqual(pageErrors,[],'no browser exceptions');
        assert.ok(perf.documentWidth<=perf.viewportWidth+2,'no horizontal overflow');
        results.push({width,trial,responseVisibleMs:Math.round(responseVisibleMs),
          ...perf,apiGets,externalBlocked,pageErrors:0});
      } finally {await ctx.close();}
    }
  }
} finally {await browser.close();}
function median(values){
  const sorted=values.filter(v=>Number.isFinite(v)).sort((a,b)=>a-b);
  if(!sorted.length)return null;
  return sorted[Math.floor(sorted.length/2)];
}
const summary=[375,1280].map(width=>{
  const p=results.filter(r=>r.width===width);
  return {width,
    medianResponseVisibleMs:median(p.map(x=>x.responseVisibleMs)),
    medianFcpMs:median(p.map(x=>x.fcpMs)),
    medianLcpMs:median(p.map(x=>x.lcpMs)),
    medianCls:median(p.map(x=>x.cls)),
    runs:p.length,initialApiGetsEach:2,externalRequests:0,
  };
});
console.log(JSON.stringify({sourceSHA:sha,kind:'SOURCE_LOCAL_SIMULATED_API_LAB',
  browser:'Chromium',isFieldCoreWebVitals:false,
  note:'Fixture API responses. Cold local server/CPU effects vary; no live TTFB/INP, Safari or real user CWV.',
  summary,runs:results},null,2));
