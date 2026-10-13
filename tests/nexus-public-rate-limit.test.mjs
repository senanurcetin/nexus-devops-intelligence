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

test('public rate limit: expanded and compressed IPv6 spellings share one budget', () => {
  const old = process.env.VERCEL;
  process.env.VERCEL = '1';
  try {
    const hit = ip => checkVercelPublicRateLimit(new Headers({
      'x-vercel-forwarded-for': ip,
    }));
    for (let n = 0; n < PUBLIC_RATE_LIMIT_REQUESTS; n++) {
      const equivalent = n % 2 === 0 ? '2001:0db8:0000:0000:0000:0000:0000:1111' : '2001:db8::1111';
      assert.equal(hit(equivalent), null);
    }
    assert.ok(hit('2001:DB8:0:0::1111'),
      'a differently spelled but identical IPv6 address cannot reset the budget');
    assert.equal(hit('2001:db8::1112'), null, 'other IPv6 sources keep their own budget');
  } finally {
    if (old === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = old;
  }
});

test('public rate limit: IPv4-mapped IPv6 shares the native IPv4 allowance', () => {
  const old = process.env.VERCEL;
  process.env.VERCEL = '1';
  try {
    const hit = ip => checkVercelPublicRateLimit(new Headers({
      'x-vercel-forwarded-for': ip,
    }));
    for (let n = 0; n < PUBLIC_RATE_LIMIT_REQUESTS; n++) {
      const ip = n % 3 === 0 ? '192.0.2.78'
        : n % 3 === 1 ? '::ffff:192.0.2.78' : '0:0:0:0:0:ffff:c000:24e';
      assert.equal(hit(ip), null);
    }
    assert.ok(hit('::FFFF:C000:24E'));
    assert.equal(hit('192.0.2.79'), null);
  } finally {
    if (old === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = old;
  }
});

test('public rate limit: source bucket cap rejects unknown keys and frees expired slots', () => {
  const now = 12_000_000;
  for (let n = 0; n < 1024; n++) {
    assert.equal(checkLocalPublicRateLimit(`bounded-fixture-${n}`, now), null,
      `distinct source ${n} should fit within the 1024 bucket cap`);
  }
  assert.deepEqual(checkLocalPublicRateLimit('bounded-new-client', now),
    { retryAfterSeconds: 60 }, 'unknown sources cannot expand in-memory storage');
  assert.equal(checkLocalPublicRateLimit('bounded-fixture-0', now), null,
    'a source with an existing bucket may still use its remaining allowance');
  assert.equal(checkLocalPublicRateLimit('bounded-new-client', now + PUBLIC_RATE_LIMIT_WINDOW_MS),
    null, 'expired keys are reclaimed on the next capacity check');
});
