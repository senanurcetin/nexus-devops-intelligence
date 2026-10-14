#!/usr/bin/env node
/**
 * R2 — Optional Upstash ACCOUNT Management API, READ-ONLY snapshot.
 *
 * Upstash REDIS REST tokens are NOT management credentials. This tool does
 * not read them, call a Redis data endpoint, spend Redis commands, inspect
 * secrets from Vercel or make requests without explicit authorization.
 *
 * Only the Upstash owner can securely make a management API key available
 * in this process environment. No key or API response body is ever printed.
 * This only resolves the Upstash *portion* of G02, NOT team Vercel usage.
 */
import { pathToFileURL } from 'node:url';

const API = 'https://api.upstash.com';
const DB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HELP = [
  'NEXUS R2 UPSTASH MANAGEMENT READ-ONLY (never deploys, never a release approval)',
  'Default: no network, INCOMPLETE / exit 2.',
  'Explicit authorized run: npm run capacity:upstash:read-only -- --authorized-readonly --json',
  'PRIVATE env: UPSTASH_MANAGEMENT_EMAIL, UPSTASH_MANAGEMENT_API_KEY,',
  '             UPSTASH_MANAGEMENT_DATABASE_ID (shared Preview+Production DB UUID)',
  'Never pass credentials in CLI arguments, chat or GitHub.',
  'Sends exactly two Management API GETs; never uses a Redis REST token.',
  'Vercel Hobby TEAM usage still requires separate verification.',
].join('\n');

const incomplete = reason => ({
  status:'INCOMPLETE', reason, source:'upstash-management-api-read-only',
  vercelTeamUsageVerified:false, releaseAuthorized:false,
});
function validNonnegativeSafe(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
export function parseUpstashMonthlyUsage(database, stats, databaseId, observedAtUtc) {
  if (!database || typeof database !== 'object' || Array.isArray(database) ||
      database.database_id !== databaseId) {
    return incomplete('Management API returned an unrelated or malformed database');
  }
  if (database.type !== 'free' || database.state !== 'active') {
    return {status:'HOLD',reason:'Database is not confirmed ACTIVE on Upstash Free',
      source:'upstash-management-api-read-only',vercelTeamUsageVerified:false,
      releaseAuthorized:false};
  }
  const names = ['total_monthly_requests','total_monthly_bandwidth',
    'total_monthly_storage','current_storage'];
  if (!stats || typeof stats !== 'object' || Array.isArray(stats) ||
      !names.every(key => validNonnegativeSafe(stats[key]))) {
    return incomplete('Monthly usage fields missing or malformed; never substitute zero');
  }
  // Decimal MB/GB are intentionally conservative relative to binary MiB/GiB.
  // total_monthly_storage is NOT always the current size: evaluate both.
  const bytes = Math.max(stats.current_storage, stats.total_monthly_storage);
  return {
    status:'UPSTASH_ONLY_VERIFIED',
    source:'upstash-management-api-read-only',
    observedAtUtc,
    upstashPlan:'free',
    upstashUsage: {
      'upstash-monthly-commands':stats.total_monthly_requests,
      'upstash-data-mb':bytes/1_000_000,
      'upstash-bandwidth-gb':stats.total_monthly_bandwidth/1_000_000_000,
    },
    // The API reports requests; billable operation accounting for custom
    // Redis EVAL/Lua has not been proved by this stats endpoint.
    units:{commands:'Upstash monthly requests',storage:'decimal MB',bandwidth:'decimal GB'},
    notes:[
      'Upstash management totals only; shared DB includes OTHER clients.',
      'Redis Lua EVAL inner-operation billing has NOT been proven.',
      'Vercel Hobby whole-TEAM usage remains missing; G02 stays OPEN.',
    ],
    vercelTeamUsageVerified:false,
    releaseAuthorized:false,
  };
}

export async function readUpstashManagementUsage({
  authorized = false, env = process.env, fetcher = fetch,
  now = () => new Date(), timeoutMs = 8000,
} = {}) {
  if (!authorized) return incomplete('No owner authorization; no network attempted');
  const email = env.UPSTASH_MANAGEMENT_EMAIL;
  const apiKey = env.UPSTASH_MANAGEMENT_API_KEY;
  const id = env.UPSTASH_MANAGEMENT_DATABASE_ID;
  if (!email || !apiKey || !id) {
    return incomplete('Upstash MANAGEMENT access not configured; no network attempted');
  }
  if (typeof email !== 'string' || !/^[^\s:@/]{1,200}@[^\s:@/]{1,200}$/.test(email) ||
      typeof apiKey !== 'string' || apiKey.length < 8 || apiKey.length > 1000 ||
      typeof id !== 'string' || !DB_ID.test(id) ||
      !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 15_000) {
    return incomplete('Invalid management access configuration; no network attempted');
  }

  const observed = now();
  if (!(observed instanceof Date) || !Number.isFinite(observed.getTime())) {
    return incomplete('Invalid UTC observation time');
  }
  const observedAtUtc = observed.toISOString();
  const urls = [
    API+'/v2/redis/database/'+id+'?credentials=hide',
    API+'/v2/redis/stats/'+id,
  ];
  const authorization = 'Basic '+Buffer.from(email+':'+apiKey,'utf8').toString('base64');
  let db;
  let stats;
  try {
    for (let i = 0; i < urls.length; i++) {
      const response = await fetcher(urls[i], {
        method:'GET',
        headers:{Authorization:authorization, Accept:'application/json'},
        redirect:'error',cache:'no-store',signal:AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return incomplete('Management API unavailable or authorization rejected');
      const payload = await response.json();
      if (i === 0) {
        db = payload;
        if (!db || db.database_id !== id || db.type !== 'free' || db.state !== 'active') {
          return parseUpstashMonthlyUsage(db, null, id, observedAtUtc);
        }
      } else stats = payload;
    }
  } catch {
    // Never print error.message, response bodies, auth headers or stacks.
    return incomplete('Management API transport or JSON validation failed');
  }
  return parseUpstashMonthlyUsage(db,stats,id,observedAtUtc);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(HELP);
  } else {
    const valid = process.argv.slice(2).every(x =>
      x === '--authorized-readonly' || x === '--json');
    const authorized = process.argv.includes('--authorized-readonly');
    const out = valid
      ? await readUpstashManagementUsage({authorized})
      : incomplete('Unknown CLI option: no network attempted');
    console.log(JSON.stringify(out,null,2));
    // Partial Upstash evidence still cannot prove G02. Zero exit status
    // means only successful data collection, never a release-gate PASS.
    if (out.status !== 'UPSTASH_ONLY_VERIFIED') process.exitCode = 2;
  }
}
