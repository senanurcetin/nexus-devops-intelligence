# R10 — Protected Preview Redis diagnostic: strict query and CDN evidence gate

**Inspection:** 14 October 2026. **Exact checked/tested source SHA:** 3779071524633694157adc05be3f9d3a3808118a.
**Result:** Manual diagnostic source defect fixed and verified **offline only**. No actual SSO Preview, Upstash Free, two-instance or Production acceptance is claimed.

## Confirmed source defect
Since merged PR #57, all five public APIs reject any query parameter other than their expected fields. The historical manual diagnostic **scripts/verify-protected-redis-preview.mjs** still sent the unrecognized **_nexus_rate_check** query on both Actions and PR GETs. Thus a current-version Preview would return **400/no-store BEFORE Redis**, making the existing diagnostic incapable of checking the Redis gate. No live Preview was called to make this finding; it is established from the actual source contracts.

## Fixed
- The diagnostic now sends **one and only one repository** parameter; no nonce or unrecognized cache-busting query fields.
- It requests no-cache via HTTP headers and the existing no-store Fetch setting. These hints are **not proof** the CDN consulted the origin.
- Any **HIT, STALE, REVALIDATED, PRERENDER, unknown or missing** Vercel cache disposition yields **INCONCLUSIVE**. Only **MISS** or **BYPASS** may proceed to the other already required security checks, and do not prove independent Vercel instances.
- Existing exact team/project HTTPS domain gate, no redirects, bounded request logic and source-attributed Redis 429 requirements remain unchanged. The default is one request; the existing **21-request flag remains prohibited in live shared Free infrastructure without separate explicit authorization**. This change did not send any such request.
- Regression tests check both API paths, exact query, cache hints, stale/missing response state, safe BYPASS, domain spoofing and no secret disclosure.

## Exact source QA
In the disposable Node 24 Linux sandbox, checked out **3779071524633694157adc05be3f9d3a3808118a**:
- Clean npm ci, **208/208 Node tests**, TypeScript and Next production build PASS.
- JS page bundle **432,228 raw / 124,819 gzip bytes** in 6 chunks, within existing limits.
- npm audit --json: **0** reported vulnerabilities at inspection.
- All Redis responses and URLs in these tests were simulated. **Zero live Upstash, SSO Preview or Production requests**.
- This source fix changes only the manual diagnostic and its tests. Previous 16/16 local HTTP plus 11/11 Chromium and Firefox belong to the preceding app source checkpoint, not remeasured by this QA.

## Kept open
R2/G02 owner account usage; R3 WebKit compatible host, Safari and human access; R6/G03 owner-approved exact-SHA SSO Preview; R7/G04 bounded live acceptance; R9/G06 actual independent Vercel function instances and real Redis evidence in issue #7; R12/G07 separate Production authorization. No paid features/CI changes.

**Source evidence:** [PR #57 strict API](https://github.com/senanurcetin/nexus-devops-intelligence/pull/57), [current release plan](NEXUS_MASTER_REMEDIATION_PLAN_2026-10-14.md), [Redis issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7).
