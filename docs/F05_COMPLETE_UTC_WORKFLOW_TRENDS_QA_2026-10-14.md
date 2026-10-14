# F-05 — budgeted, coverage-gated seven-day UTC workflow volume

**Date:** 14 October 2026 · **Status:** implemented in GitHub branch, validated **without live Upstash, Preview, Production or GitHub trend queries**; separate release approval required.

## Source-backed feasibility decision

GitHub's [list workflow runs for a repository](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-repository) supports a `created` date-time filter, `total_count` and at most **100 records per page**. The endpoint can return up to 1,000 matches for filtered searches; a single page cannot prove a complete period on active repositories. GitHub's [anonymous REST primary limit](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#primary-rate-limit-for-unauthenticated-users) is **60 GETs/hour per originating IP**, with secondary limits. Given the earlier unmocked public GitHub Actions smoke **429**, F-05 intentionally avoids any new automatic or stress queries.

**Scope decision: seven fully completed UTC calendar dates** ending no later than yesterday and at most 30 completed UTC dates ago. The browser selects yesterday; server parses and bounds `end=YYYY-MM-DD`, then builds the fixed UTC inclusive `created=YYYY-MM-DDT00:00:00Z..YYYY-MM-DDT23:59:59Z` range. No rolling-hour window, local DST conversion, arbitrary years, multi-page fanout or background poll.

| Operation | New NEXUS requests | Configured shared Redis origin admissions | New uncached GitHub GETs |
| --- | ---: | ---: | ---: |
| Normal dashboard load / repo share URL / F-01 export / filters | **0** | **0** | **0** |
| Explicit **Load 7-day UTC trend** click | **1** | **1** | **exactly 1 maximum** |
| Hide/reopen **already successfully loaded** matching repo/date trend | **0** | **0** | **0** |
| Change repository or refresh Actions | **0 automatic trend requests** | **0 automatic trend admissions** | **0 automatic trend GETs** |

Existing baseline unchanged at **2 dashboard API GETs and max 7 public GitHub upstream GETs**, and earlier F-04 PR/run user-triggered details have their own separate budgets. The new route `GET /api/public-workflow-trends?repository=owner%2Frepository&end=YYYY-MM-DD` uses strict single parameter occurrences, no extras, valid public repository and bounded completed UTC day **before** Redis/GitHub. Existing shared Redis per-IP 20/min admission applies; configured Redis unavailable means fail-closed 503, exhausted limit means 429. When Redis genuinely is unconfigured, existing local guard remains. Identical concurrent requests can coalesce within a serverless instance; no hosted CI.

## Data coverage, truthfulness and graph semantics

GitHub response `total_count` and enumerated `workflow_runs` length must match **exactly**, with at most 100 rows, unique positive run IDs, canonical original GitHub URLs, valid UTC `created_at` strictly within the seven-day range and valid bounded status/conclusion. Only then is `coverage=complete` and a seven-row chart returned. The browser separately verifies repository, date window, counts, exact consecutive UTC days, nonnegative bucket sums and completeness before displaying values.

If GitHub reports **101+** matching runs, fewer rows than `total_count`, or any otherwise incomplete page: `coverage=incomplete`, `days=[]`, and an **explicit partial coverage warning with no chart or inferred success percentage**. Invalid/mismatched/duplicate/malformed data: **502 no-store**, not a successful partial metric. **Zero** matching runs is a valid complete week with seven labeled zeros.

Each completed day's `success`, `failed`, `pending`, `other` numbers classify **run objects by their UTC creation date and current API status/conclusion at read time**, not their final status as of midnight on that day. Cancelled/skipped/neutral are not silently called failures. The relative bar length represents **daily run volume**, not reliability percentage. This is a *coverage-verified API snapshot*, not a CI SLA, incident frequency, complete permanent archive, proof of successful branch protection, or a statement about uninspected older/future history. It cannot guarantee GitHub did not omit records beyond its API contract.

No token, raw runner log, new origin, outbound share, new runtime package, historical database, scheduler or secret dependency. All text is rendered via React as data, not HTML. Responsive count table is keyboard-focusable as a named scroll region to preserve mobile/zoom accessibility.

## Manual, CI-free test evidence

Source `3dfebd4e9754df2152f1fae241353910de846040` in isolated **Node 24 temporary Vercel Sandbox**, production-built and served only on loopback.

| Check | Result |
| --- | --- |
| `npm ci` / `npm test` | **182/182 passed**, including **10 new** F-05 tests: UTC dates/30-day bound, seven-day bucketing, incomplete suppression, zero runs, malformed/duplicate/unsafe/out-of-window records, exact one-GET query, upstream 429, invalid route 400 before Redis, fully intercepted atomic fake Redis admission/429, click-only UI source contract |
| `npm run typecheck`, `npm run build` | **PASS**, including new dynamic `/api/public-workflow-trends` |
| `npm run inspect:budget` | **6 page JS chunks**, **431,862 raw / 124,789 gzip bytes**; under existing **537,600 raw / 163,840 gzip** limits (local JS only; does not include production latency or Core Web Vitals) |
| `npm audit --json` | **0 vulnerabilities at inspection time** |
| Chromium 143, **375px**, *complete* | **2** initial intercepted Actions+PR API GETs; **0** automatic trends; exactly **1** explicit trend GET; seven UTC days with outcome counts shown, collapsed/reopened with **0** additional GETs; **0** uncaught exceptions/document overflow/axe WCAG A/AA issues (28 passed rules). Final-source retest passed. |
| Chromium 143, **375px**, *incomplete* | GitHub fixture 100 of 201 → **no** trend table and explicit partial warning, **one** clicked trend GET; **0** a11y violations (26 passing rules). Final-source retest passed. |
| Chromium 143, **375px**, *zero matching runs* | Seven fully labeled **zero-count** dates; one clicked trend GET; **0** a11y violations |
| Chromium 143, **1280px**, *simulated upstream 429* | Bounded **47s** retry notice, no misleading chart, **0** a11y violations |
| Chromium 143, **375px**, *repository switch* | Previously loaded chart cleared; no automatic new historical GET; default two-panel source refresh only; **0** a11y violations |
| Local route security | Invalid/duplicate/future/too-old `end` and unknown query parameters rejected **400** before any synthetic GitHub/Redis access; one allowed synthetic Redis admission then a blocked 429 with zero downstream GitHub calls; **0 real Upstash** |
| Client errors / horizontal overflow | **0** across all completed browser checks |

**Accessibility defect caught and fixed during browser validation:** an initially scrollable trend table lacked keyboard focus and triggered axe `scrollable-region-focusable`. Added a keyboard-focusable, named `role=region` with visible focus outline and permanent structural regression assertions; retested real Chromium on **the final source**. It is a tested, resolved defect, not a silently ignored axe warning.

**Excluded acceptance:** authenticated SSO-protected real Vercel Preview, Safari/WebKit, physical-device/NVDA/VoiceOver human signoff, real GitHub date-filter endpoint quota behavior, live Upstash shared quota headroom, independent Vercel serverless rate enforcement, broader high-volume pagination, total-cost telemetry, true historical workflow reliability. No prior GitHub Actions smoke 429 retest was attempted.

## Release constraints

- GitHub branch/PR only until merged; no CI, CircleCI, paid services, Git auto-deploy, actual Vercel API/Redis origin load, env/secret inspection, SSO bypass, WAF changes or Production deployment.
- Existing protected Preview app version **`599ced7`**, Production app **`74cd0e3`** remain older and **do not include F-01–F-05** until separately authorized and pinned deployment.
- R-04 owner-authenticated Preview visual runtime acceptance; R-05 real human Safari/device/screen-reader signoff; R-06 live independent Vercel Redis proof issue [#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) are **open**. Owner deferred additional screenshots.
