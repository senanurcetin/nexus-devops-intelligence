import { pathToFileURL } from 'node:url';

const PROJECT = 'nexus-devops-intelligence';
const TEAM_SUFFIX = '-senanurs-projects-102fb36c.vercel.app';
const TEST_REPOSITORY = 'senanurcetin/nexus-devops-intelligence';
const LIMIT = 20;
const MAX_DURATION_MS = 55_000;

/**
 * Restrict preview probes (and any protection-bypass header) to deployments
 * under the actual NEXUS project + Vercel team namespace. A matching prefix
 * under an arbitrary attacker-owned vercel.app host must not receive a token.
 * Production aliases and the main-branch alias are explicitly excluded.
 */
export function safeNexusPreviewOrigin(input) {
  try {
    const u = new URL(input);
    const hostname = u.hostname.toLowerCase();
    const prefix = `${PROJECT}-`;
    if (u.protocol !== 'https:' || u.username || u.password || u.port ||
        u.pathname !== '/' || u.search || u.hash ||
        !hostname.startsWith(prefix) || !hostname.endsWith(TEAM_SUFFIX)) return null;
    const deploymentId = hostname.slice(prefix.length, -TEAM_SUFFIX.length);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(deploymentId) ||
        deploymentId === 'git-main' || deploymentId.startsWith('git-main-')) return null;
    return u.origin;
  } catch {
    return null;
  }
}

function validRetryAfter(value) {
  if (typeof value !== 'string' || !/^[0-9]{1,2}$/.test(value)) return false;
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 1 && seconds <= 60;
}

/**
 * Bounded, read-only, same-client origin diagnostic. This intentionally makes
 * no multi-instance or WAF claims. Without an explicit origin-request
 * authorization, this code must do ZERO network calls. The 21-request
 * sequence is an OPTIONAL, separately approved same-client diagnostic, not
 * independent Vercel-instance proof.
 *
 * This probe never guarantees a cache miss; if the edge serves a cached HIT,
 * its evidence is inconclusive. Without quota clearance/owner consent, no
 * real traffic should be sent at all.
 * Don't pass arbitrary URLs to this function: the origin is checked before
 * constructing headers, and fetch follows no redirects.
 */
export async function probeProtectedRedisPreview({
  url,
  fetcher = fetch,
  bypassToken = '',
  confirm21 = false,
  authorizedRequests = 0,
  now = () => Date.now(),
}) {
  const origin = safeNexusPreviewOrigin(url);
  if (!origin) return { state: 'blocked', reason: 'not-an-allowed-protected-preview', requests: 0,
    crossInstanceVerified: false, releaseAuthorized: false };
  // Authorization must agree with the requested test mode. No network,
  // including the one-request preflight, is permitted by default.
  if (authorizedRequests !== (confirm21 ? LIMIT + 1 : 1)) {
    return { state: 'blocked', reason: 'explicit-origin-request-authorization-required',
      requests: 0, crossInstanceVerified: false, releaseAuthorized: false };
  }
  // Only the public route's strictly allowed "repository" parameter is sent.
  // Do NOT use arbitrary cache-busting query keys: every public API rejects
  // those with HTTP 400 *before* consulting the shared Redis admission gate.
  // Request no-cache, then independently reject confirmed edge-cache hits;
  // this is advisory to CDNs, not guaranteed proof of an origin invocation.
  const headers = {
    'Cache-Control': 'no-cache, no-store, max-age=0',
    Pragma: 'no-cache',
    ...(bypassToken ? { 'x-vercel-protection-bypass': bypassToken } : {}),
  };
  const limit = confirm21 ? LIMIT + 1 : 1;
  const startedAt = now();
  let allowed = 0;
  for (let index = 1; index <= limit; index++) {
    if (now() - startedAt > MAX_DURATION_MS) {
      return { state: 'inconclusive', reason: 'test-window-expired', requests: index - 1 };
    }
    const path = index % 2 === 1 ? '/api/public-actions' : '/api/public-prs';
    const req = new URL(path, origin);
    req.searchParams.set('repository', TEST_REPOSITORY);
    let response;
    try {
      response = await fetcher(req.toString(), {
        method: 'GET', cache: 'no-store', redirect: 'manual',
        headers, signal: AbortSignal.timeout(12_000),
      });
    } catch {
      return { state: 'blocked', reason: 'network-or-auth-failure', requests: index };
    }
    if ([301, 302, 303, 307, 308, 401, 403].includes(response.status)) {
      return { state: 'blocked', reason: 'preview-authentication-required', requests: index };
    }
    // A HIT, STALE, REVALIDATED or absent CDN status is not trustworthy
    // proof of a fresh origin execution. Only explicit MISS/BYPASS status
    // is eligible as *one* prerequisite, never independent instance proof.
    const cacheStatus = response.headers.get('x-vercel-cache')?.trim().toUpperCase();
    if (cacheStatus !== 'MISS' && cacheStatus !== 'BYPASS') {
      return {
        state: 'inconclusive',
        reason: cacheStatus === 'HIT'
          ? 'edge-cache-hit-not-an-origin-proof'
          : 'edge-cache-state-not-confirmed',
        requests: index,
      };
    }
    if (response.status === 429) {
      const originSource = response.headers.get('x-nexus-rate-limit-source');
      const correctHeaders = originSource === 'shared-redis' &&
        response.headers.get('cache-control')?.includes('no-store') &&
        validRetryAfter(response.headers.get('retry-after'));
      return correctHeaders && confirm21 && index === LIMIT + 1 && allowed === LIMIT
        ? { state: 'partial', reason: 'redis-attributed-429-same-client-only', requests: index,
            admitted: allowed, pathsChecked: ['actions', 'prs'],
            crossInstanceVerified: false, releaseAuthorized: false }
        : { state: 'inconclusive', reason: correctHeaders
            ? 'shared-quota-already-in-use-or-window-moved'
            : '429-not-attributed-to-redis', requests: index };
    }
    if (response.status !== 200) {
      return { state: 'blocked', reason: 'unexpected-api-status', requests: index };
    }
    if (response.headers.get('x-nexus-rate-limit-mode') !== 'shared-redis') {
      return { state: 'blocked', reason: 'redis-not-active-or-old-deployment', requests: index };
    }
    allowed++;
  }
  return { state: confirm21 ? 'inconclusive' : 'ready',
    reason: confirm21 ? 'no-429-within-bounded-probe' : 'redis-mode-preflight-passed',
    requests: limit, admitted: allowed, crossInstanceVerified: false,
    releaseAuthorized: false };
}

const invoked = process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  const args = process.argv.slice(2);
  const flag = '--preview-url';
  const urlIndices = args.flatMap((arg, i) => arg === flag ? [i] : []);
  const recognized = new Set([
    flag, '--confirm-1-request', '--confirm-21-request-test',
    '--approve-free-tier-21-origin-reads',
  ]);
  const valueIndex = urlIndices.length === 1 ? urlIndices[0] + 1 : -1;
  const validArgs = urlIndices.length === 1 &&
    valueIndex < args.length &&
    args[valueIndex].startsWith('https://') &&
    args.every((arg, i) => i === valueIndex || recognized.has(arg)) &&
    (args.includes('--confirm-1-request') !==
      args.includes('--confirm-21-request-test'));
  // Two explicit, independent opt-ins to avoid accidentally spending the
  // owner's shared Free Redis quota on the 21-request mode. CLI switches
  // are still NOT permission to bypass owner approval/governance.
  const confirm21 = args.includes('--confirm-21-request-test');
  const authorizedRequests = validArgs
    ? (confirm21
      ? args.includes('--approve-free-tier-21-origin-reads') ? 21 : 0
      : !args.includes('--approve-free-tier-21-origin-reads') ? 1 : 0)
    : 0;
  const result = await probeProtectedRedisPreview({
    url: valueIndex >= 0 ? args[valueIndex] : '',
    bypassToken: process.env.NEXUS_PREVIEW_PROTECTION_BYPASS || '',
    confirm21,
    authorizedRequests,
  });
  console.log(JSON.stringify(result));
  // The 21-request same-client test can never indicate G06 PASS.
  // Only a single-request preflight has a nonzero CLI "ready" meaning.
  if (result.state !== 'ready') process.exitCode = 2;
}
