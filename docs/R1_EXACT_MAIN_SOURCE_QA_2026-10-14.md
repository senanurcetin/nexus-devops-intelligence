# R1 — Clean current-main source QA and immutable release candidate (offline)

**Date:** 14 October 2026 (Europe/Istanbul).
**Repository:** senanurcetin/nexus-devops-intelligence.
**Exact 40-character code and docs SHA tested:** `2df2ea635fd57b0d9f4d852818f6de55e0f1e3ce`.
**Status:** R1 **DONE_OFFLINE**, not a deployed / owner-approved release candidate.
**Change type since previous source verification:** PR #61 fixed the manual protected Redis diagnostic, with no application client/runtime modification. This record explicitly reruns the whole available QA suite on the merged `main`, not merely the older PR branch.

## Reproducible results, disposable local-only Vercel Sandbox

GitHub SHA was fetched with a shallow checkout into an ephemeral Node 24 Amazon Linux 2023 sandbox. The code was cleanly installed using `npm ci --no-audit --no-fund`, then:

| Test | Actual result |
| --- | --- |
| Source SHA | `2df2ea635fd57b0d9f4d852818f6de55e0f1e3ce` |
| `npm test` | **208 of 208 passed**, 0 failed |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** |
| `npm run inspect:budget` | **PASS**, 6 page JS chunks, 432,228 raw / 124,819 gzip bytes; caps 537,600 / 163,840 |
| `npm audit --json` | **0 reported vulnerabilities** in info/low/moderate/high/critical |
| `NEXUS_BASE_URL=http://127.0.0.1:3050/ npm run smoke:http:offline` | **16/16 PASS** against built Next server: one local HTML + 15 invalid or duplicate source query 400/no-store responses |
| `NEXUS_BROWSER_ENGINE=chromium npm run test:browser:manual` | **11/11 PASS**, Playwright Chromium 156.0.8078.4 |
| `NEXUS_BROWSER_ENGINE=firefox npm run test:browser:manual` | **11/11 PASS**, Playwright Firefox 157.0 |

Manual browser tools `playwright-core@1.64.0` / `axe-core@4.11.0` were installed **without saving to the repository**. The first Firefox run was interrupted when the disposable sandbox expired; that run is **not claimed as a pass**. A freshly resumed sandbox re-started the *same checked-out source* and completed a new Firefox **11/11 pass**. Chromium completed before the interruption.

In all completed browser fixture scenarios: zero unexpected external navigation, zero uncaught page JS errors, zero whole-page horizontal overflow and zero **automatically detected** WCAG 2/2.1 A/AA axe violations. API interception returned only source-valid fixture data. No valid real GitHub or Upstash API traffic was used, and no NEXUS Preview/Production deployment occurred.

**Scope limitations:** page-JS budget is not a whole CSS/network/Core Web Vitals measurement. Automated axe is not a human screen-reader or Safari test. Playwright WebKit **not passed**: on the supported Microsoft Ubuntu 24.04 browser image, the connected Vercel Sandbox cannot directly run an external Microsoft container image; custom images require deployment into Vercel Container Registry. The existing Amazon Linux host has ICU 67 and lacks browser ICU 74, GTK/GStreamer/Flite. Neither image migration nor paid external registry service is authorized merely by this QA.

## Current exact-source publication inventory

This SHA represents a **source candidate available on GitHub**, not a deployed release. The most recent verified live targets remain older:

- Protected Preview `599ced76605c25161b182b2d5bfbadbd091bfb53`.
- Production `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf`.

The owner has **not** authorized a new exact-SHA protected Preview, any additional Redis Free commands, a 21-request rate test or Production. Git auto-deploy remains disabled.

## Required separate release gates

- **R2/G02:** owner-provided aggregate Upstash Free command/data/bandwidth usage and all-project Vercel Hobby invocation/CPU/memory totals with time and Preview GET budget.
- **R3 / G05:** Playwright WebKit on a supported runnable test environment; real macOS/iOS Safari; human NVDA/VoiceOver and visual/editorial signoff.
- **R6/G03 + R7/G04:** separately authorized exact SHA `2df2ea...` SSO Preview and small bounded source/data verification.
- **R9/G06 / Issue #7:** actual independent Vercel Function instances and measured Redis attribution; source-only local/fake counters insufficient.
- **R12/G07:** separate owner Production authorization, deployment identity, rollback and narrow post-release smoke.

**Status statement:** R1 clean **offline** evidence is COMPLETE; the NEXUS product is **not verified for current-source live Preview or Production release**.
