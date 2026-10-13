import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Presentation regression only — no live API, CI quota or deployment calls.
test('NEXUS dashboard keeps app functionality while using sapphire brand identity', () => {
  const page = readFileSync('src/app/page.tsx', 'utf8');
  const css = readFileSync('src/app/globals.css', 'utf8');
  for (const expected of ['nexus-devops', 'nexus-devops-hero', 'nexus-devops-card',
      'Public API · Read-only preview', '/api/public-actions', '/api/public-prs']) {
    assert.ok(page.includes(expected), expected);
  }
  assert.ok(css.includes('#071829'));
  assert.ok(css.includes('#4ea8ff'));
  assert.ok(css.includes('prefers-reduced-motion'));
  assert.ok(page.includes('nexus-devops-section'));
  assert.ok(page.includes('nexus-devops-evidence'));
  assert.ok(page.includes('nexus-devops-investigations'));
  assert.ok(page.includes('nexus-devops-eyebrow'));
  assert.ok(page.includes('nexus-devops-lockup'));
  assert.ok(page.includes('NEXUS Developer Intelligence home'));
  assert.ok(page.includes('nexus-devops-evidence-note'));
  assert.ok(page.includes('nexus-devops-data-state'));
  assert.ok(!page.includes('lastApiResponseAt'));
  assert.ok(page.includes('actionsReceivedAt'));
  assert.ok(page.includes('pullsReceivedAt'));
  assert.equal(page.split('if (result.data) setActionsReceivedAt(').length - 1, 1);
  assert.equal(page.split('if (result.data) setPullsReceivedAt(').length - 1, 1);
  assert.ok(page.includes('Independent GitHub source receipt status'));
  assert.ok(page.includes('Verified sample received at'));
  assert.ok(page.includes('No verified sample received for this selection'));
  assert.ok(page.includes('Unavailable; no verified sample'));
  assert.ok(page.includes('data-source="actions"'));
  assert.ok(page.includes('data-source="prs"'));
  assert.ok(css.includes('.nexus-devops-receipt-grid'));
  assert.ok(css.includes('.nexus-devops-received-at'));
  assert.ok(page.includes('PARTIAL DATA · REVIEW PANEL ERRORS'));
  assert.ok(page.includes('BOTH SOURCE PANELS UNAVAILABLE'));
  assert.ok(page.includes('Retry both GitHub source panels'));
  assert.ok(page.includes("if (actions.error) refreshPanel('actions', selectedRepo);"));
  assert.ok(page.includes("if (pulls.error) refreshPanel('prs', selectedRepo);"));
  assert.ok(page.includes('Retry GitHub Actions source panel'));
  assert.ok(page.includes('Retry GitHub PR source panel'));
  assert.ok(css.includes('.nexus-devops-retry'));
  assert.ok(page.includes("actions.error && pulls.error ? 'failed'"));
  assert.ok(css.includes('data-state="failed"'));
  assert.ok(page.includes('BOTH SOURCE PANELS LOADED'));
  assert.ok(css.includes('data-state="warning"'));
  assert.ok(css.includes('.nexus-devops-company'));
  assert.ok(css.includes('.nexus-devops-event'));
  assert.ok(page.includes('nexus-devops-warning'));
  assert.ok(page.includes('bg-[#4ea8ff]'));
  assert.ok(css.includes('.nexus-devops-warning'));
});
