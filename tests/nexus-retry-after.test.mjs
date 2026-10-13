import test from 'node:test';
import assert from 'node:assert/strict';
import { safeRetryAfterSeconds } from '../src/lib/nexus-retry-after.ts';

test('retry-after: accepts a bounded numeric delta in seconds', () => {
  for (const [input, expected] of [['1', 1], ['60', 60], [' 120 ', 120], ['3600', 3600]]) {
    assert.equal(safeRetryAfterSeconds(input), expected);
  }
});

test('retry-after: rejects invalid, oversized and date values', () => {
  for (const input of [undefined, null, '', '0', '-1', '+5', '3601', '99999999999',
    'NaN', '12 seconds', 'Wed, 21 Oct 2026 07:28:00 GMT', '1\nSet-Cookie: secret=1']) {
    assert.equal(safeRetryAfterSeconds(input), null, String(input));
  }
});
