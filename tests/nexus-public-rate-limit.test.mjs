import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLIC_RATE_LIMIT_REQUESTS,
  PUBLIC_RATE_LIMIT_WINDOW_MS,
  checkLocalPublicRateLimit,
  checkVercelPublicRateLimit,
} from '../src/lib/nexus-public-rate-limit.ts';

test('public rate limit: 20 shared route requests pass, 21st is 429 with safe wait', () => {
  const now = 2_000_000;
  for (let n = 0; n < PUBLIC_RATE_LIMIT_REQUESTS; n++) {
    assert.equal(checkLocalPublicRateLimit('fixture-local-user-1', now + n), null);
  }
  assert.deepEqual(checkLocalPublicRateLimit('fixture-local-user-1', now + 20),
    { retryAfterSeconds: 60 });
  assert.deepEqual(checkLocalPublicRateLimit('fixture-local-user-1', now + 59_500),
    { retryAfterSeconds: 1 });
  assert.equal(checkLocalPublicRateLimit('fixture-local-user-1', now + PUBLIC_RATE_LIMIT_WINDOW_MS), null,
    'a new fixed window permits a new request');
});

test('public rate limit: per-source budgets remain separate', () => {
  const now = 3_000_000;
  for (let n = 0; n < PUBLIC_RATE_LIMIT_REQUESTS; n++) {
    assert.equal(checkLocalPublicRateLimit('fixture-independent-A', now), null);
  }
  assert.equal(checkLocalPublicRateLimit('fixture-independent-B', now), null);
  assert.ok(checkLocalPublicRateLimit('fixture-independent-A', now));
});

test('public rate limit: only trusted Vercel source IP is used, not spoofable XFF', () => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = '1';
  const headers = ip => new Headers({
    'x-vercel-forwarded-for': '2001:db8::1',
    'x-forwarded-for': ip,
  });
  try {
    for (let n = 0; n < PUBLIC_RATE_LIMIT_REQUESTS; n++) {
      assert.equal(checkVercelPublicRateLimit(headers(`203.0.113.${n + 1}`)), null);
    }
    assert.ok(checkVercelPublicRateLimit(headers('198.51.100.1')),
      'changing ordinary forwarding headers must not bypass the quota');
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});

test('public rate limit: unknown Vercel source uses a shared conservative bucket', () => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = '1';
  try {
    for (let n = 0; n < PUBLIC_RATE_LIMIT_REQUESTS; n++) {
      assert.equal(checkVercelPublicRateLimit(new Headers({
        'x-vercel-forwarded-for': n % 2 ? 'two,ips' : 'spoof-invalid',
      })), null);
    }
    assert.ok(checkVercelPublicRateLimit(new Headers()));
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});

test('public rate limit: non-Vercel runtimes are not claimed as protected', () => {
  const previous = process.env.VERCEL;
  delete process.env.VERCEL;
  try {
    for (let n = 0; n < PUBLIC_RATE_LIMIT_REQUESTS + 4; n++) {
      assert.equal(checkVercelPublicRateLimit(new Headers({
        'x-vercel-forwarded-for': '203.0.113.155',
      })), null);
    }
  } finally {
    if (previous !== undefined) process.env.VERCEL = previous;
  }
});
