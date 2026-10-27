import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicActionsSample, isPublicPullSample } from '../src/lib/nexus-panel-validation.ts';

const repository = 'synthetic/offline';
function check(timestamp) {
  return [
    isPublicActionsSample({
      repository, total_matching_runs: 1, inspected_runs: 1,
      successful_runs: 1, failed_runs: 0, pending_runs: 0, other_outcome_runs: 0,
      scope_note: 'Synthetic offline fixture',
      runs: [{ id: 1, name: 'Synthetic', event: 'push', status: 'completed',
        conclusion: 'success', created_at: timestamp,
        html_url: 'https://github.com/synthetic/offline/actions/runs/1' }],
    }, repository),
    isPublicPullSample({
      repository, inspected_prs: 1, more_open_prs: false,
      conflicts: 0, needs_attention: 0, unknown: 0,
      scope_note: 'Synthetic offline fixture',
      pull_requests: [{ number: 1, title: 'Synthetic', author: 'synthetic',
        explanation: 'Synthetic', attention: 'clear', updated_at: timestamp,
        html_url: 'https://github.com/synthetic/offline/pull/1' }],
    }, repository),
  ];
}

test('both public validators accept strict UTC timestamps', () => {
  const valid = [
    '2026-10-27T11:00:00Z', '2024-02-29T23:59:59Z',
    '2000-02-29T00:00:00Z', '0000-02-29T00:00:00Z',
    '0099-01-01T00:00:00Z', '9999-12-31T23:59:59Z',
    ...Array.from({ length: 9 }, (_, i) =>
      '2026-10-27T11:00:00.' + '123456789'.slice(0, i + 1) + 'Z'),
  ];
  for (const value of valid) assert.deepEqual(check(value), [true, true], value);
});

test('both public validators reject loose formats and calendar rollover', () => {
  const invalid = [
    '1', '2026-02-30T11:00:00Z', '2026-02-29T11:00:00Z',
    '1900-02-29T11:00:00Z', '2026-04-31T11:00:00Z',
    '2026-00-01T11:00:00Z', '2026-13-01T11:00:00Z',
    '2026-01-00T11:00:00Z', '2026-01-32T11:00:00Z',
    '2026-10-27T24:00:00Z', '2026-10-27T11:60:00Z',
    '2026-10-27T11:00:60Z', '2026-10-27',
    '2026-10-27T11:00:00', '2026-10-27T11:00:00+00:00',
    '2026-10-27t11:00:00z', '2026-10-27 11:00:00Z',
    '2026-10-27T11:00:00.Z', '2026-10-27T11:00:00.1234567890Z',
    '2026-10-27T11:00:00Z\n', ' 2026-10-27T11:00:00Z',
    '+002026-10-27T11:00:00Z', '', null, 1, {}, [],
  ];
  const accepted = invalid.map(value => ({ value, results: check(value) }))
    .filter(({ results }) => results.some(Boolean));
  assert.deepEqual(accepted, [], 'Invalid timestamps accepted by public validators');
});
