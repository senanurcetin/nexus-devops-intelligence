import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/app/page.tsx', 'utf8');
const css = readFileSync('src/app/globals.css', 'utf8');

test('source evidence preserves full validated workflow and PR titles', () => {
  assert.ok(page.includes('nexus-devops-source-title text-sm font-medium text-slate-200'));
  assert.ok(page.includes('{run.name}</p>'));
  assert.ok(page.includes('{pr.title}'));
  assert.ok(!page.includes('className="truncate text-sm font-medium text-slate-200"'));
  assert.ok(css.includes('.nexus-devops-source-title { white-space: normal; }'));
  assert.ok(css.includes('overflow-wrap: anywhere'));
});

test('navigation and source record links remain keyboard-accessible at constrained widths', () => {
  assert.ok(page.includes('aria-label="Dashboard sections"'));
  assert.ok(page.includes('nexus-devops-evidence-controls'));
  assert.ok(page.includes('nexus-devops-run-actions'));
  assert.ok(page.includes('flex flex-wrap items-start justify-between gap-3 p-5'));
  assert.ok(css.includes('.nexus-devops-command-nav { min-width: 0; max-width: 100%; }'));
  assert.ok(css.includes('.nexus-devops-evidence-controls > button'));
  assert.ok(css.includes('min-height: 40px'));
  assert.ok(css.includes('focus-visible'));
});

test('sample evidence tick grid reflows under browser/text zoom and respects long URLs', () => {
  assert.ok(css.includes('.nexus-devops-run-sequence ol,'));
  assert.ok(css.includes('.nexus-devops-pr-sequence ol'));
  assert.ok(css.includes('repeat(auto-fit, minmax(min(100%, 3rem), 1fr))'));
  assert.ok(css.includes('.nexus-devops-queue-item,'));
  assert.ok(css.includes('.nexus-devops-event,'));
  assert.ok(css.includes('prefers-reduced-motion'));
  assert.ok(page.includes('href={pr.html_url}'));
  assert.ok(page.includes('href={run.html_url}'));
});
