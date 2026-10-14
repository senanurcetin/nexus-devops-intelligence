#!/usr/bin/env node
/**
 * G-02 owner-supplied, OFFLINE Free-capacity screen. No HTTP, Redis calls,
 * environment variables, credentials, filesystem reads or usage APIs.
 *
 * The output NEVER authorizes Preview, Production, rate-limit stress, or
 * paid plan changes. "READY_FOR_OWNER_REVIEW" is not release approval.
 * See docs/G02_CAPACITY_PREFLIGHT_2026-10-14.md for provenance and limitations.
 */
import {pathToFileURL} from 'node:url';

const LIMITS = Object.freeze({
  upstashMonthlyCommands: 500_000,
  upstashDataMb: 250, // Owner screenshot 2026-10-14 displays 250 MB, more restrictive than historical 256.
  upstashBandwidthGb: 10,
  vercelInvocations: 1_000_000,
  vercelActiveCpuHours: 4,
  vercelMemoryGbHours: 360,
});
const PLANNING_REDIS_COMMANDS_PER_ORIGIN = 4;
const REVIEW_CEILING = 0.8; // Owner-chosen safety buffer, NOT vendor hard cap.
const MAX_EVIDENCE_AGE_MS = 48 * 60 * 60 * 1000;
const EXPECTED_FIELDS = Object.freeze({
  'observed-at-utc': 'timestamp',
  'upstash-monthly-commands': 'integer',
  'upstash-data-mb': 'number',
  'upstash-bandwidth-gb': 'number',
  'vercel-invocations': 'integer',
  'vercel-active-cpu-hours': 'number',
  'vercel-provisioned-memory-gb-hours': 'number',
  'planned-origin-requests': 'integer',
});
const HELP = `NEXUS G-02 OFFLINE capacity screen (never a release approval)
Usage: npm run capacity:offline -- [all named, aggregate, non-secret usage values]
  --observed-at-utc 2026-10-14T00:00:00Z
  --upstash-monthly-commands <nonnegative integer, SHARED database current month>
  --upstash-data-mb <nonnegative size of that shared database>
  --upstash-bandwidth-gb <nonnegative current-month shared database bandwidth>
  --vercel-invocations <nonnegative current-period TEAM total>
  --vercel-active-cpu-hours <nonnegative current-period TEAM total>
  --vercel-provisioned-memory-gb-hours <nonnegative current-period TEAM total>
  --planned-origin-requests <nonnegative planned additional origin requests>
  --json                        machine-readable output

No secrets/API URLs/tokens. Missing/stale data => INCOMPLETE; consumption above
80% planning ceilings => HOLD. READY_FOR_OWNER_REVIEW is NOT authorization.
Do not add an Upstash EVAL/load test or deploy to get these numbers.
`;

export function screenCapacity(inputs, now = new Date()) {
  const missing = Object.keys(EXPECTED_FIELDS).filter(key => inputs[key] === undefined);
  if (missing.length) return { status:'INCOMPLETE', reason:'Missing independently observed aggregate usage fields', missing };

  const observed = inputs['observed-at-utc'];
  const observedMs = Date.parse(observed);
  const nowMs = now.getTime();
  if (!Number.isFinite(observedMs) || !Number.isFinite(nowMs) ||
    observedMs > nowMs + 60_000 || nowMs - observedMs > MAX_EVIDENCE_AGE_MS) {
    return {status:'INCOMPLETE', reason:'Usage snapshot is invalid, future-dated or older than 48 hours'};
  }
  const ym = d => new Date(d).toISOString().slice(0, 7);
  if (ym(observedMs) !== ym(nowMs)) {
    return { status:'INCOMPLETE', reason:'Upstash monthly snapshot must belong to current UTC month' };
  }

  const plannedRequests = inputs['planned-origin-requests'];
  const estimate = plannedRequests * PLANNING_REDIS_COMMANDS_PER_ORIGIN;
  if (!Number.isSafeInteger(estimate)) return {status:'INCOMPLETE',reason:'Planning estimate exceeds safe-integer range'};

  const checks = [
    ['Upstash shared monthly commands',inputs['upstash-monthly-commands']+estimate,LIMITS.upstashMonthlyCommands,'commands',estimate],
    ['Upstash shared data',inputs['upstash-data-mb'],LIMITS.upstashDataMb,'MB',0],
    ['Upstash shared bandwidth',inputs['upstash-bandwidth-gb'],LIMITS.upstashBandwidthGb,'GB',0],
    ['Vercel Hobby TEAM invocations',inputs['vercel-invocations']+plannedRequests,LIMITS.vercelInvocations,'invocations',plannedRequests],
    ['Vercel Hobby TEAM active CPU',inputs['vercel-active-cpu-hours'],LIMITS.vercelActiveCpuHours,'CPU-hours',0],
    ['Vercel Hobby TEAM provisioned memory',inputs['vercel-provisioned-memory-gb-hours'],LIMITS.vercelMemoryGbHours,'GB-hours',0],
  ];
  const metrics = checks.map(([name, projected, limit, unit, addition]) => ({
    name, unit, projected, limit, plannedAddition: addition,
    reviewCeiling: limit * REVIEW_CEILING,
    withinConservativeReviewCeiling: projected <= limit * REVIEW_CEILING,
  }));
  const warnings = [
    'Four Redis commands per origin request is a conservative planning assumption, not a verified billing measurement.',
    'Actual requests, Lua billing, retries, cache misses, additional projects and future CPU/memory usage may differ.',
    'This is an owner-reviewed capacity screen only. It neither deploys nor authorizes live Redis traffic.',
  ];
  return {
    status: metrics.every(x=>x.withinConservativeReviewCeiling) ? 'READY_FOR_OWNER_REVIEW' : 'HOLD',
    source:'human-entered Vercel team/Upstash database dashboard totals',
    observedAtUtc:observed,
    planning:{ plannedOriginRequests:plannedRequests,
      assumedRedisCommandsPerOrigin:PLANNING_REDIS_COMMANDS_PER_ORIGIN,
      assumedAdditionalRedisCommands:estimate,
      reviewReservePercent:20,
      oneOriginInvocationPerRequestAssumed:true,
      snapshotFreshnessHours:48 },
    metrics, warnings,
  };
}

function parse(raw) {
  const values = {};
  let json = false;
  for (let i = 0; i < raw.length; i++) {
    const key = raw[i];
    if (key === '--json') { json = true; continue; }
    if (!key.startsWith('--') || !(key.slice(2) in EXPECTED_FIELDS)) {
      throw new Error('Unknown or unexpected option. Never pass credentials, URLs, or connection strings.');
    }
    const field = key.slice(2);
    if (field in values) throw new Error('Repeated capacity field: ' + field);
    const token = raw[++i];
    if (token === undefined || token.startsWith('--')) throw new Error('Missing value: ' + field);
    if (EXPECTED_FIELDS[field] === 'timestamp') {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(token) ||
        !Number.isFinite(Date.parse(token)) ||
        new Date(token).toISOString() !== new Date(Date.parse(token)).toISOString()) {
        throw new Error('Invalid UTC observation timestamp');
      }
      values[field] = token;
    } else {
      if (!(EXPECTED_FIELDS[field] === 'integer' ?
        /^(?:0|[1-9]\d*)$/.test(token) :
        /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(token))) {
        throw new Error('Numeric usage fields require a nonnegative decimal number');
      }
      const num = Number(token);
      if (!Number.isFinite(num) || num < 0 ||
        (EXPECTED_FIELDS[field] === 'integer' && !Number.isSafeInteger(num))) {
        throw new Error('Invalid numeric usage value');
      }
      values[field] = num;
    }
  }
  return {values, json};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(HELP);
  } else {
    try {
      const {values,json} = parse(process.argv.slice(2));
      const result = screenCapacity(values);
      if (json) console.log(JSON.stringify(result,null,2));
      else {
        console.log('G-02 '+result.status+': '+(result.reason || 'capacity screen only, release permission NOT granted'));
        if (result.missing) console.log('Missing: '+result.missing.join(', '));
        if (result.metrics) {
          for (const x of result.metrics) console.log(
            (x.withinConservativeReviewCeiling ? 'WITHIN SCREEN' : 'HOLD')+' '+x.name+
            ': projected '+x.projected+' '+x.unit+'; conservative review ceiling '+
            x.reviewCeiling+' / vendor ceiling '+x.limit,
          );
        }
        for (const warning of result.warnings||[]) console.log('CAUTION '+warning);
      }
      if (result.status !== 'READY_FOR_OWNER_REVIEW') process.exitCode = 2;
    } catch (e) {
      console.error('G-02 INVALID INPUT: '+String(e.message));
      process.exitCode = 2;
    }
  }
}
