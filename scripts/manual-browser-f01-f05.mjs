#!/usr/bin/env node
/**
 * Deterministic CI-free real-browser F01–F05 integration regression.
 *
 * Run ONLY against a locally served production build:
 *   npm ci && npm run build
 *   npm install --no-save --package-lock=false playwright-core@1.64.0 axe-core@4.11.0
 *   npx playwright-core install chromium
 *   npm run start
 *   node --import tsx scripts/manual-browser-f01-f05.mjs
 *
 * All five app APIs are intercepted BEFORE any request can reach Next/Redis/
 * GitHub. Any unexpected API path fails closed. External browser navigation
 * is blocked. Only localhost is accepted. No protected Preview or Production.
 */
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { summarizePublicActions } from '../src/lib/github-public-actions.ts';
import { summarizePublicPullRequests } from '../src/lib/nexus-public-prs.ts';
import { summarizePublicPrVerification } from '../src/lib/nexus-pr-evidence.ts';
import { summarizePublicRunEvidence } from '../src/lib/nexus-workflow-run-evidence.ts';
import { summarizePublicWorkflowTrend } from '../src/lib/nexus-workflow-trends.ts';

const require = createRequire(import.meta.url);
const source = new URL(process.env.NEXUS_BROWSER_BASE_URL || 'http://127.0.0.1:3000/');
if (source.protocol !== 'http:' ||
  !['localhost', '127.0.0.1', '[::1]'].includes(source.hostname) ||
  source.pathname !== '/' || source.search || source.hash ||
  source.username || source.password) {
  throw new Error('Browser regression is loopback-only; refuse public Preview/Production URLs.');
}
const base = source.origin;
const captureDir = process.env.NEXUS_BROWSER_CAPTURE_DIR || null;
const exactSourceTag = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {encoding:'utf8'}).trim();
const repoA = 'owner/one', repoB = 'owner/two';
const stamp = '2026-10-13T12:00:00Z';
const sha = 'a'.repeat(40);
const paths = new Set([
  '/api/public-actions', '/api/public-prs', '/api/public-pr-verification',
  '/api/public-workflow-evidence', '/api/public-workflow-trends',
]);
const dateOnly = (d) => d.toISOString().slice(0, 10);
const endUtc = dateOnly(new Date(Date.parse(dateOnly(new Date()) + 'T00:00:00Z') - 86400000));
const startUtc = dateOnly(new Date(Date.parse(endUtc + 'T00:00:00Z') - 6 * 86400000));

const runId = repo => repo === repoA ? 91 : 291;
const prId = repo => repo === repoA ? 21 : 221;
function sampleActions(repo) {
  const id = runId(repo);
  return summarizePublicActions(repo, { total_count: 2, workflow_runs: [
    { id, name: repo === repoA ? '=HYPERLINK("https://attacker.invalid","click")' : 'Repo TWO CI',
      event: 'push', status: 'completed', conclusion: 'failure', created_at: stamp,
      html_url: 'https://github.com/' + repo + '/actions/runs/' + id },
    { id: id + 1, name: 'Verified successful build', event: 'push', status: 'completed',
      conclusion: 'success', created_at: stamp,
      html_url: 'https://github.com/' + repo + '/actions/runs/' + (id + 1) },
  ]});
}
function samplePrs(repo) {
  const n = prId(repo);
  return summarizePublicPullRequests(repo, [{
    number: n, title: repo === repoA ? '+cmd|powershell' : 'Repo TWO PR',
    draft: false, updated_at: stamp, user: { login: 'contributor' },
    html_url: 'https://github.com/' + repo + '/pull/' + n,
  }], [{ number: n, mergeable_state: 'dirty', mergeable: false,
    html_url: 'https://github.com/' + repo + '/pull/' + n }]);
}
function samplePrEvidence(repo) {
  const n = prId(repo);
  return summarizePublicPrVerification(repo, n, {
    number: n, state: 'open', head: { sha },
    html_url: 'https://github.com/' + repo + '/pull/' + n,
  }, { total_count: 1, check_runs: [{ id: 71, name: 'Lint', status: 'completed',
    conclusion: 'success' }] }, [{
    id: 81, user: { login: 'reviewer' }, state: 'APPROVED', submitted_at: stamp,
  }]);
}
function sampleRunEvidence(repo) {
  const id = runId(repo);
  return summarizePublicRunEvidence(repo, id, {
    id, html_url: 'https://github.com/' + repo + '/actions/runs/' + id,
    status: 'completed', conclusion: 'failure', head_sha: sha, run_attempt: 2,
  }, { total_count: 1, jobs: [{
    id: 601, run_id: id, run_attempt: 2, name: 'Integration tests',
    status: 'completed', conclusion: 'failure', steps: [{
      number: 1, name: 'Verify contracts', status: 'completed', conclusion: 'failure',
    }],
  }] });
}
function sampleTrend(repo, incomplete = false) {
  const id = runId(repo);
  const rows = [
    { id, status: 'completed', conclusion: 'failure',
      created_at: startUtc + 'T12:00:00Z',
      html_url: 'https://github.com/' + repo + '/actions/runs/' + id },
    { id: id + 1, status: 'completed', conclusion: 'success',
      created_at: endUtc + 'T12:00:00Z',
      html_url: 'https://github.com/' + repo + '/actions/runs/' + (id + 1) },
  ];
  return summarizePublicWorkflowTrend(repo, endUtc, {
    total_count: incomplete ? 10 : 2, workflow_runs: rows,
  });
}
function fixtureResponse(path, repo, params, scenario) {
  if (![repoA, repoB].includes(repo)) return {status: 400, body: {error: 'Fixture source not allowed'}};
  if (path === '/api/public-actions') {
    return scenario === 'partial' && repo === repoA
      ? {status: 503, body: {error: 'Fixture Actions unavailable'}}
      : {status: 200, body: sampleActions(repo)};
  }
  if (path === '/api/public-prs') return {status: 200, body: samplePrs(repo)};
  if (path === '/api/public-pr-verification') {
    assert.equal(params.get('number'), String(prId(repo)), 'selected PR identity');
    return {status: 200, body: samplePrEvidence(repo)};
  }
  if (path === '/api/public-workflow-evidence') {
    assert.equal(params.get('id'), String(runId(repo)), 'selected failed run identity');
    return {status: 200, body: sampleRunEvidence(repo)};
  }
  if (path === '/api/public-workflow-trends') {
    assert.equal(params.get('end'), endUtc, 'last completed UTC day');
    return {status: 200, body: sampleTrend(repo, scenario === 'incomplete')};
  }
  throw new Error('Unrecognized API: ' + path);
}

async function runJourney(browser, name, width, scenario) {
  const context = await browser.newContext({
    viewport: {width, height: 900}, acceptDownloads: true,
    serviceWorkers: 'block',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  const calls = [], jsErrors = [], blocked = [];
  page.on('pageerror', error => jsErrors.push(error.message));
  // Critical safety boundary: intercept ALL app API requests; block all
  // non-local URLs even if an unexpected application link is clicked.
  await page.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    try {
      if (url.origin !== base) {
        blocked.push(url.origin);
        return await route.abort();
      }
      if (!url.pathname.startsWith('/api/')) return await route.continue();
      assert.ok(paths.has(url.pathname), 'Unexpected live API route ' + url.pathname);
      assert.equal(req.method(), 'GET');
      const repository = url.searchParams.get('repository');
      calls.push({ path: url.pathname, repo: repository });
      if (scenario === 'race' && repository === repoA) {
        await new Promise(resolve => setTimeout(resolve, 850));
      }
      const reply = fixtureResponse(url.pathname, repository, url.searchParams, scenario);
      await route.fulfill({status: reply.status, contentType: 'application/json',
        headers: { 'cache-control': 'no-store' }, body: JSON.stringify(reply.body)});
    } catch (e) {
      jsErrors.push('Route intercept: ' + String(e));
      try { await route.abort(); } catch {}
    }
  });
  const initial = scenario === 'invalid'
    ? '/?repo=owner%2Fone&repo=owner%2Ftwo'
    : '/?repo=owner%2Fone';
  async function download(name) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', {name}).click();
    const item = await pending;
    const body = await readFile(await item.path(), 'utf8');
    return body;
  }
  async function ready(repo) {
    await page.getByText('Selected: ' + repo, {exact:true}).waitFor({timeout:15000});
    await page.getByRole('button', {name:'Export JSON'}).waitFor({timeout:15000});
    await page.getByRole('button', {name:'Export JSON'}).click({trial:true});
  }
  try {
    await page.goto(base + initial, {waitUntil:'domcontentloaded'});
    if (scenario === 'invalid') {
      await page.getByRole('alert').filter({hasText:/Invalid repository in shared link/}).waitFor();
      assert.equal(calls.length, 0, 'invalid duplicate repo causes zero API calls');
      assert.equal(await page.getByRole('button', {name:'Export JSON'}).isDisabled(), true);
    } else if (scenario === 'race') {
      // Wait until initial source calls really exist before racing their responses.
      // Without this guard a fast tester can type before React hydrates the URL.
      for (let i = 0; i < 125 && calls.length < 2; i++) await page.waitForTimeout(40);
      assert.equal(calls.length, 2, 'initial repository panel GETs must be in flight');
      await page.getByRole('textbox', {name:/Public GitHub repository/}).fill(repoB);
      await page.getByRole('button', {name:/Analyze repository/}).click();
      await ready(repoB);
      // Delayed old responses must not replace the selected new repository.
      await page.waitForTimeout(1100);
      const json = JSON.parse(await download('Export JSON'));
      assert.equal(json.repository, repoB);
      assert.equal(json.actions.records[0].name, 'Repo TWO CI');
      assert.equal(await page.getByText('+cmd|powershell', {exact:true}).count(), 0);
      assert.deepEqual(calls.map(c => c.path).filter(x => x === '/api/public-pr-verification' ||
        x === '/api/public-workflow-evidence' || x === '/api/public-workflow-trends'), []);
      assert.equal(calls.length, 4, 'two panel calls for each source');
    } else if (scenario === 'partial') {
      await ready(repoA);
      const json = JSON.parse(await download('Export JSON'));
      assert.equal(json.repository, repoA);
      assert.equal(json.actions, null);
      assert.equal(json.pull_requests.exported_prs, 1);
      assert.equal((await download('Export CSV')).includes('actions_sample_metadata'), false);
      assert.equal(calls.length, 2, 'partial export must not refetch');
    } else {
      await ready(repoA);
      assert.equal(calls.length, 2, 'only two initial panel API calls');
      const chartMeasures = await page.evaluate(() => ({
        bars:[...document.querySelectorAll('.nexus-devops-outcome-bar, .nexus-devops-pr-bar')].map(node => node.getBoundingClientRect().height),
        cells:document.querySelectorAll('.nexus-devops-composition-item').length,
      }));
      assert.equal(chartMeasures.bars.length, 2, 'both independent source charts rendered');
      assert.ok(chartMeasures.bars.every(h => h >= 22), 'sample chart height must remain readable');
      assert.equal(chartMeasures.cells, 9, '4 Actions and 5 PR composition labels');
      const json = JSON.parse(await download('Export JSON'));
      assert.equal(json.repository, repoA);
      assert.equal(json.actions.inspected_runs, 2);
      assert.equal(json.pull_requests.inspected_prs, 1);
      assert.equal(json.data_source, 'public-github-rest');
      const csv = await download('Export CSV');
      assert.match(csv, /"'=HYPERLINK\(/, 'CSV injection neutralized');
      assert.match(csv, /"'\+cmd\|powershell"/);
      assert.equal(calls.length, 2, 'exports incur zero extra GETs');
      await page.getByRole('button', {name:'Inspect check & review events'}).first().click();
      await page.getByRole('region', {name:'GitHub evidence for PR #21'})
        .getByText('Lint', {exact:true}).waitFor();
      await page.getByRole('button', {name:'Inspect job & step evidence'}).first().click();
      await page.getByRole('region', {name:'Workflow job evidence for run #91'})
        .getByText(/Integration tests/).waitFor();
      assert.equal(calls.filter(c => c.path.includes('verification') ||
        c.path.includes('evidence')).length, 2, 'two clicked evidence GETs');
      await page.getByRole('button', {name:'Load 7-day UTC trend'}).click();
      if (scenario === 'incomplete') {
        await page.getByText('Incomplete coverage', {exact:false}).waitFor();
        assert.equal(await page.getByRole('region', {name:/Seven-day UTC workflow count table/}).count(), 0);
      } else {
        const table = page.getByRole('region', {name:/Seven-day UTC workflow count table/});
        await table.waitFor();
        assert.equal(await table.locator('tbody tr').count(), 7);
        const tableMeasures = await table.evaluate(node => ({
          viewport: node.clientWidth,
          content: node.scrollWidth,
          trackHeights:[...node.querySelectorAll('.nexus-devops-trend-track')].map(x => x.getBoundingClientRect().height),
          headerSize:getComputedStyle(node.querySelector('thead th')).fontSize,
        }));
        assert.ok(tableMeasures.trackHeights.every(h => h >= 16), 'UTC bars must be >= 16px');
        assert.ok(parseFloat(tableMeasures.headerSize) >= 11.5, 'UTC header labels must be legible');
        assert.ok(tableMeasures.content >= tableMeasures.viewport, 'UTC table scroll safely contained');
      }
      assert.equal(calls.length, 5, 'two panels plus three manually triggered detail GETs');
      const hide = scenario === 'incomplete' ? null : page.getByRole('button', {name:'Hide 7-day UTC trend'});
      if (hide) {
        await hide.click();
        await page.getByRole('button', {name:'Load 7-day UTC trend'}).click();
        assert.equal(calls.length, 5, 'collapse/reopen must not refetch trend');
      }
      await page.getByRole('textbox', {name:/Public GitHub repository/}).fill(repoB);
      await page.getByRole('button', {name:/Analyze repository/}).click();
      await ready(repoB);
      assert.equal(await page.getByRole('region', {name:'GitHub evidence for PR #21'}).count(), 0);
      assert.equal(await page.getByRole('region', {name:'Workflow job evidence for run #91'}).count(), 0);
      assert.equal(await page.getByRole('region', {name:/Seven-day UTC workflow count table/}).count(), 0);
      const repoTwo = JSON.parse(await download('Export JSON'));
      assert.equal(repoTwo.repository, repoB);
      assert.equal(repoTwo.actions.records[0].name, 'Repo TWO CI');
      await page.goBack({waitUntil:'domcontentloaded'});
      await ready(repoA);
      assert.equal(calls.length, 9, '2 initial + 3 detail + 2 switch + 2 Back');
    }
    assert.deepEqual(jsErrors, [], 'no uncaught browser errors or unsafe intercepted API calls');
    assert.equal(await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 2), false,
      'document must not overflow viewport width');
    // Contrast/semantic automation is useful evidence, not human accessibility signoff.
    const axePath = require.resolve('axe-core/axe.min.js');
    await page.addScriptTag({path: axePath});
    const audit = await page.evaluate(async () => {
      const r = await window.axe.run(document, {
        runOnly:{type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},
      });
      return r.violations.map(v => v.id);
    });
    assert.deepEqual(audit, [], 'automated axe WCAG A/AA');
    let screenshot = null;
    if (captureDir) {
      await mkdir(captureDir, {recursive:true});
      screenshot = join(captureDir, 'nexus-'+exactSourceTag+'-'+name+'-'+width+'px.png');
      await page.screenshot({path:screenshot, fullPage:true, animations:'disabled'});
    }
    console.log(JSON.stringify({
      sourceSHA:exactSourceTag, screenshot,
      scenario:name, viewport:width, result:'PASS', apiGETs:calls.length,
      interceptedByPath:Object.fromEntries([...paths].map(p => [p,calls.filter(c=>c.path===p).length])),
      blockedExternalOrigins:blocked.length, axeViolations:0, pageErrors:0,
    }));
  } finally {
    await context.close();
  }
}

let chromium;
try {
  ({chromium} = await import('playwright-core'));
} catch {
  throw new Error('Install optional manual-browser tools with npm install --no-save --package-lock=false playwright-core@1.64.0 axe-core@4.11.0');
}
const browser = await chromium.launch({
  headless: true,
  ...(process.env.NEXUS_CHROMIUM_EXECUTABLE
    ? {executablePath: process.env.NEXUS_CHROMIUM_EXECUTABLE} : {}),
  args: ['--no-sandbox'],
});
try {
  for (const [name,width,scenario] of [
    ['complete-narrow',320,'complete'],
    ['complete-mobile',375,'complete'],
    ['complete-tablet',768,'complete'],
    ['complete-desktop',1280,'complete'],
    ['complete-wide',1440,'complete'],
    ['partial-source-mobile',375,'partial'],
    ['incomplete-trend-desktop',1280,'incomplete'],
    ['rapid-source-switch-mobile',375,'race'],
    ['duplicate-share-link-mobile',375,'invalid'],
  ]) await runJourney(browser,name,width,scenario);
  console.log('F01–F05 fixture browser regression: all nine sessions PASSED (no live API/Redis calls).');
} finally {
  await browser.close();
}
