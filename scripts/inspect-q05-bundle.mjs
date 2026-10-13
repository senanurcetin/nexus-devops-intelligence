#!/usr/bin/env node
/**
 * CI-free post-build budget inspection for NEXUS page JavaScript.
 * Usage: npm run build && npm run inspect:budget
 * Reads only local .next assets; never contacts Redis, GitHub or Vercel.
 * Per-asset gzip sums do not measure HTTP transfer, latency or hydration.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const buildDir = resolve('.next');
const manifest = JSON.parse(readFileSync(resolve(buildDir, 'app-build-manifest.json'), 'utf8'));
const assets = manifest.pages?.['/page'];
assert.ok(Array.isArray(assets) && assets.length, 'Build first; /page app manifest is missing.');

const js = [...new Set(assets.filter(name => typeof name === 'string' && name.endsWith('.js')))];
assert.ok(js.length, 'No app page JavaScript chunks were found.');
let rawBytes = 0;
let gzipBytes = 0;
for (const asset of js) {
  assert.match(asset, /^static\/chunks\/[a-zA-Z0-9/_.-]+\.js$/, 'Unexpected app asset location');
  assert.ok(!asset.split('/').includes('..'), 'Asset path cannot escape .next');
  const source = readFileSync(resolve(buildDir, asset));
  rawBytes += source.length;
  gzipBytes += gzipSync(source).length;
}

// 13 Oct baseline: 401,241 raw / 117,432 gzip bytes. These caps include
// reasonable headroom and signal review, not a performance/latency SLA.
const caps = { rawBytes: 525 * 1024, gzipBytes: 160 * 1024 };
const report = {
  measurement: 'local-next-app-page-js-assets',
  page: '/page',
  chunks: js.length,
  rawBytes,
  gzipBytes,
  caps,
  withinBudget: rawBytes <= caps.rawBytes && gzipBytes <= caps.gzipBytes,
  scope: 'local build-only; excludes live TTFB, API calls, CSS, images and Core Web Vitals',
};
console.log(JSON.stringify(report, null, 2));
assert.ok(report.withinBudget, 'Client JS budget exceeded; review bundle changes before release.');
