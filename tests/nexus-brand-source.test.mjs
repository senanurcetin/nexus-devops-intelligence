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
  assert.ok(css.includes('.nexus-devops-event'));
  assert.ok(page.includes('nexus-devops-warning'));
  assert.ok(page.includes('bg-[#4ea8ff]'));
  assert.ok(css.includes('.nexus-devops-warning'));
});
