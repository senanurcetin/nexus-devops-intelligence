import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicActionsSample, isPublicPullSample } from '../src/lib/nexus-panel-validation.ts';

const repository = 'owner/repo';
const action = created_at => ({
  repository, total_matching_runs: 1, inspected_runs: 1,
  successful_runs: 1, failed_runs: 0, pending_runs: 0, other_outcome_runs: 0,
  scope_note: 'Synthetic, offline test fixture',
  runs: [{ id: 7, name: 'CI', event: 'push', status: 'completed', conclusion: 'success',
    created_at, html_url: `https://github.com/${repository}/actions/runs/7` }],
});
const pull = updated_at => ({
  repository, inspected_prs: 1, more_open_prs: false,
  conflicts: 0, needs_attention: 0, unknown: 0,
  scope_note: 'Synthetic, offline test fixture',
  pull_requests: [{ number: 9, title: 'Fix', author: 'builder',
    updated_at, html_url: `https://github.com/${repository}/pull/9`,
    attention: 'clear', explanation: 'Synthetic clear state' }],
});

test('valid canonical UTC GitHub timestamps are accepted', () => {
  for (const value of ['2026-10-13T11:00:00Z', '2026-10-13T11:00:00.123Z', '2024-02-29T23:59:59Z']) {
    assert.equal(isPublicActionsSample(action(value), repository), true, value);
    assert.equal(isPublicPullSample(pull(value), repository), true, value);
  }
});

test('non-ISO, offset and nonexistent GitHub dates are rejected at the browser boundary', () => {
  for (const value of ['1', '2026-02-30T11:00:00Z', '2026-04-31T11:00:00Z',
    '2026-10-13T11:00:00+03:00', 'Tue, 13 Oct 2026 11:00:00 GMT', '2026-10-13']) {
    assert.equal(isPublicActionsSample(action(value), repository), false, `Actions: ${value}`);
    assert.equal(isPublicPullSample(pull(value), repository), false, `PR: ${value}`);
  }
});
