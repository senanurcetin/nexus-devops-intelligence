import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const page = readFileSync('src/app/page.tsx', 'utf8');
const css = readFileSync('src/app/globals.css', 'utf8');

test('executive sections use real anchor links with four unique destinations', () => {
  const anchors = ['overview', 'intelligence', 'investigations', 'evidence'];
  assert.ok(page.includes('aria-label="Dashboard sections"'));
  for (const name of anchors) {
    assert.ok(page.includes(`href="#${name}"`), name);
    assert.equal((page.match(new RegExp(`id="${name}"`, 'g')) ?? []).length, 1, name);
  }
  assert.ok(css.includes('scroll-margin-top'));
  assert.ok(css.includes('overflow-x: auto'));
  assert.ok(css.includes('position: sticky'));
});

test('source-backed recommendations precede the evidence table and follow visual intelligence', () => {
  const idx = ['id="overview"', 'id="intelligence"', 'id="investigations"', 'id="evidence"']
    .map(s => page.indexOf(s));
  assert.ok(idx.every(i => i > 0));
  assert.ok(idx.every((v, i) => i === 0 || v > idx[i - 1]));
  assert.ok(page.includes('nexus-devops-intelligence-grid'));
  assert.ok(page.includes('nexus-devops-queue-item'));
  assert.ok(page.includes('data-severity={item.severity}'));
  assert.ok(page.includes('recommendInvestigations(actions.data, pulls.data)'));
});

test('executive navigation is a pure source-only presentation, not an API-triggering control', () => {
  assert.equal((page.match(/className="nexus-devops-command-link"/g) || []).length, 4);
  const nav = page.slice(page.indexOf('<nav className="nexus-devops-command-nav"'),
    page.indexOf('</nav>', page.indexOf('<nav className="nexus-devops-command-nav"')));
  assert.equal((nav.match(/<a href="#/g) || []).length, 4);
  assert.ok(!nav.includes('onClick'));
  assert.ok(!nav.includes('fetch('));
  assert.ok(page.includes("if (actions.error) refreshPanel('actions', selectedRepo);"));
  assert.ok(page.includes("if (pulls.error) refreshPanel('prs', selectedRepo);"));
});

test('warning and source priority hierarchy remain meaningful rather than automatic release claims', () => {
  assert.ok(page.includes('data-severity={item.severity}'));
  assert.ok(page.includes('No repository changes are made by this preview.'));
  assert.ok(page.includes('No token, AI diagnosis, account-wide billing data or deployment claim.'));
  assert.ok(css.includes('.nexus-devops-queue-item[data-severity="high"]'));
  assert.ok(css.includes('.nexus-devops-queue-item[data-severity="medium"]'));
  assert.ok(css.includes('.nexus-devops-command-nav'));
});
