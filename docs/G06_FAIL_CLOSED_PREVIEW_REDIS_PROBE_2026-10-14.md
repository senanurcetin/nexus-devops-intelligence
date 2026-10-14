# G06 — Preview Redis test must never claim independent-instance PASS from same-client requests

**Inspection date:** 14 October 2026 (Europe/Istanbul).  
**Repository:** `senanurcetin/nexus-devops-intelligence`.  
**Exact executable source QA SHA:** `cc4e97de83a807cdb2a016509de7bff215bbdcce`.  
**Status:** G06 **test-harness security defect DONE_OFFLINE**; G06 independent **real Vercel function instances still OPEN**.

## Source defect

Prior `scripts/verify-protected-redis-preview.mjs` could:
1. **Send a real origin GET by default** when handed any syntactically valid project Preview URL, even when the caller had not explicitly approved that request.
2. Begin **21** real Actions/PR API reads with only `--confirm-21-request-test`, despite the owner's earlier explicit exclusion of live Redis stress and despite shared Free resource limits.
3. Return `{state:'passed', crossInstanceVerified:false}` after 20 same-client `200` responses followed by one Redis-attributed `429`. Such a sequence may establish a Redis-origin admission decision for **one requesting client**, but **cannot** establish that two independently identified Vercel serverless instances enforce one shared budget.

These were **test harness permission and evidence integrity defects**, not a claim that the real Redis limiter has failed in Production. The script's old `passed` output could be mistakenly read as closing [P0 Issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7).

## Repair

### Default: zero requests, including Redis preflight

Calling the exported `probeProtectedRedisPreview` function without **`authorizedRequests:1`** returns `blocked / explicit-origin-request-authorization-required / requests:0`, `crossInstanceVerified:false`, `releaseAuthorized:false`. Likewise `confirm21:true` needs precisely **`authorizedRequests:21`**, otherwise returns `blocked` **before any fetch**. Mismatched values (negative, 0, 1 vs 21, 21 vs 1, 1000) all fail closed.

For the CLI, the only valid opt-in single preflight form is:

```sh
node scripts/verify-protected-redis-preview.mjs --preview-url https://<EXACT-NEXUS-PREVIEW-URL>/ --confirm-1-request
```

For the *separately explicitly owner-authorized* full same-client diagnostic the CLI requires **both** `--confirm-21-request-test` and `--approve-free-tier-21-origin-reads`, along with an allowed Preview URL. Those switches do **not** substitute for owner authorization; without the user's consent, DO NOT invoke them. Unexpected options, no confirmation, 21 without the separate Free-budget switch, mixed 1/21 flags, or 1 together with the 21 budget switch produce `blocked/0 requests`. The script always validates a very narrow NEXUS team generated Preview HTTPS hostname first, disallows production aliases, usernames, query fragments and redirects, and never prints the Preview protection bypass token. There is no automatic cron, CI, retry or deployment.

**Existing preflight with 1 explicitly authorized request** may produce `state:'ready'` but includes `crossInstanceVerified:false` and `releaseAuthorized:false`. A 20/21 same-client Redis attribution now produces **`state:'partial'`** and **`reason:'redis-attributed-429-same-client-only'`**; CLI exits with code **2**, not the former misleading successful status. **This script has NO code path producing G06 PASS**. Neither an edge CDN MISS/BYPASS header nor Redis mode/header proves two independent instances.

**Real owner approval is still required** separately before even the default single request; this documentation is not a live-test authorization.

## Checked source regression

Disposable isolated Node24 Linux Vercel Sandbox with exact source SHA `cc4e97de83a807cdb2a016509de7bff215bbdcce`. No valid external GitHub/Upstash source requests or live NEXUS Preview/Production probes were performed.

| QA | Actual |
| --- | --- |
| `npm ci --no-audit --no-fund` | PASS |
| `node --test tests/protected-redis-preview-probe.test.mjs` | **15/15 PASS** |
| `npm test` | **224/224 PASS** |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run inspect:budget` | PASS, six page JS chunks **433,926 raw / 125,339 gzip**, caps 537,600 / 163,840 |
| `npm audit --json` | **0** reported vulnerabilities |
| Built Next loopback `smoke:http:offline` | **16/16 PASS** |
| Playwright Chromium fixture `test:browser:manual` | **11/11 PASS** |
| Playwright Firefox fixture `test:browser:manual` | **11/11 PASS** |

Three new Node unit tests exercise default **zero network**, mismatched/missing owner origin allowance, correctly attributed 21st `429` **never G06 PASS**, and fail-closed CLI flag parsing including unrecognized arguments/secret non-disclosure. Existing mocked response tests were updated to declare exact authorized request budgets and assert **`partial`**, not `passed`. The explicit real-source QA call with the **currently deployed NEXUS Preview URL but NO consent flag** returned:

```json
{"state":"blocked","reason":"explicit-origin-request-authorization-required","requests":0,"crossInstanceVerified":false,"releaseAuthorized":false}
```

Exit code was **2**. The test failed closed **before network**, thus consumed **zero** NEXUS Preview, GitHub or Upstash quota.

Browser fixture runs intercept all public APIs before any real Vercel/Redis access, show zero blocked external origins, zero unexpected page JS errors and zero detected A/AA axe violations. This commit does not alter app runtime API, rate limiter, UI, headers, auth, existing deployment or Production alias.

## G06/#7 still requires independent real-instance acceptance

Future G06 can only be considered accepted after independent trusted proof identifies **at least two different live Vercel Function instances serving the same approved exact-SHA protected Preview**, each properly attested to the same Redis shared bucket, and shows an authentic **Redis-attributed origin 429** (including `Cache-Control:no-store` and bounded `Retry-After`), not a CDN/WAF or local-only denial. Need documented origin-request count, interval, account-level Free usage delta and explicit authorization for test traffic; duplicate request IDs, different regions, two separate tabs or two local processes **alone** are not independent Vercel instance identity.

At this inspection, the latest verified deployed SSO Preview is **`2b5fb7c379bd1f939f3b50f286edfb868ddb386a`**, while current source GitHub `main` is newer; previous attempt to update Preview was blocked by platform controls. **No second deployment attempted** in this G06 work. Do not enable paid Vercel observability, rate-limit stress, bypass SSO or ship to Production to try to generate the missing evidence.

**Outcome:** necessary security and accounting precondition is fixed. **Issue #7 stays OPEN**, human G05 and authenticated live G04 still OPEN; no new Production permission follows from this offline repair.
