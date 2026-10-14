# S-03 — Five public GitHub API routes: strict query contract and fail-closed QA

**Date:** 14 October 2026 (Europe/Istanbul).  
**Project:** `senanurcetin/nexus-devops-intelligence`.  
**Exact tested code SHA:** `c131446c05a9551733602bc1909468beef538593` (later documentation-only commits do not change runtime).  
**Engineering result:** PASS on isolated localhost fixtures; **no actual Vercel distributed rate-limit acceptance**.

## Reason for patch

The F04 PR verification, workflow-run evidence and F05 UTC-trend API endpoints already required exactly one `repository` parameter and rejected extra query fields. The older `/api/public-actions` and `/api/public-prs` instead used `URLSearchParams.get('repository')`, silently selecting the first matching entry from ambiguous URLs such as:

```text
/api/public-actions?repository=owner%2Fone&repository=owner%2Ftwo
/api/public-prs?repository=owner%2Fone&debug=true
```

Both are now **HTTP 400 + `Cache-Control:no-store` before Redis admission or GitHub fanout**, matching the already strict on-demand APIs. The UI sends a single canonical `repository` query, so valid consumer behavior and GitHub data contracts are unchanged.

### Five-route security matrix

| Public REST route | Required query | Invalid/duplicate | Redis count over shared 20/min window | Redis unavailable or partly configured |
| --- | --- | --- | --- | --- |
| `/api/public-actions` | exactly one `repository` | 400 / no-store | 429 / no-store / `Retry-After` / `X-Nexus-Rate-Limit-Source:shared-redis` | 503 / no-store / `Retry-After:5` |
| `/api/public-prs` | exactly one `repository` | same | same | same |
| `/api/public-pr-verification` | one `repository`, one `number` | same | same | same |
| `/api/public-workflow-evidence` | one `repository`, one `id` | same | same | same |
| `/api/public-workflow-trends` | one `repository`, one `end` UTC day | same | same | same |

The tests use a **fake** Upstash REST endpoint and intercept all outgoing calls. A simulated `EVAL` result `[21,17]` produces an attributed Redis 429 with `Retry-After:17` for each of the five routes; the EVAL request contains the same opaque per-IP hashed bucket for every route. Simulated Redis 503, missing token and untrusted Upstash host fail closed before GitHub. **These are contract tests of application behavior, not proof of live quota or two independent Vercel instances.**

## Exact-source offline evidence

The disposable Node.js 24 sandbox checked out exactly `c131446c05a9551733602bc1909468beef538593`.

- `npm ci --no-audit --no-fund`: PASS.
- `npm test`: **204/204 Node tests PASS**, including **five new security contract tests** for all five APIs.
- `npm run typecheck` and `npm run build`: PASS.
- `npm run inspect:budget`: six page-JS chunks, **432,115 bytes raw / 124,819 bytes gzip**, within the established limits; these are NOT live network/Core Web Vitals measurements.
- `npm audit --json`: **0 reported vulnerabilities** at check time.
- Built Next production server bound to `127.0.0.1:3018` plus `NEXUS_BASE_URL=http://127.0.0.1:3018 npm run smoke:http:offline`: **16/16 HTTP checks**. One HTML route plus *five* `400 / no-store` invalid repository queries, *five* duplicate-source rejections and *five* unrecognized-parameter rejections. **Zero intentionally valid GitHub/Upstash requests.** Offline smoke retains strict loopback-only origin validation.
- `NEXUS_BROWSER_BASE_URL=http://127.0.0.1:3018/ npm run test:browser:manual`: **11/11 real-Chromium fixture journeys PASS** at 320, 375, 768, 1280 and 1440 CSS px plus simulated 200%/400% root-font enlargement. All sessions: **0 unexpected JS page errors, 0 whole-page overflow, 0 axe WCAG 2/2.1 A/AA violations, 0 external-origin network calls**. Optional browser libraries installed only for this manual QA checkout.

All five route tests use `NextRequest`/`NextResponse`; the 16 negative HTTP checks exercise compiled Next server behavior. Every invalid input is rejected **before** redis/github, preserving the team's shared free quotas. No actual Upstash token or URL was read or passed to these tests.

## Unchanged release blockers

- **G-02**: true shared database command/storage/bandwidth and **whole Hobby team** invocation/CPU/memory usage are **unknown**. The offline calculator does NOT substitute for account statistics.
- **G-03/G-04**: the current code is NOT deployed to protected Preview; actual signed-in Preview API/UI evidence still requires separate explicit owner approval.
- **G-05**: human Safari/mobile/NVDA/VoiceOver plus editorial design acceptance unverified.
- **G-06/#7**: Redis atomic Lua behavior across actual independent Vercel Function instances has **not** been demonstrated. The fake REST response confirms only our handling of **a simulated counter result**, and the local Redis multiprocess test proves only locally controlled instances.
- **G-07**: Production deployment remains not authorized.

This document is engineering evidence, **not** a Production/Preview release approval.
