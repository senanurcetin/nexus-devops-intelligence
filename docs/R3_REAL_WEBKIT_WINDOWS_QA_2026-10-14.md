# R3 — Native Windows Playwright WebKit acceptance evidence (14 October 2026)

**Repository:** `senanurcetin/nexus-devops-intelligence`.  
**Exact executable Git SHA:** `7bd062d30bec50fb83ecca1ad031a14b75816a46`.  
**State:** **R3 automated WebKit engine QA — DONE_OFFLINE / 11 of 11 PASS**.  
**Distinction:** This is **NOT** a real iPhone Safari, iOS VoiceOver, NVDA, or SSO-protected Preview test. G05 human device/assistive technology remains **OPEN**.

## Why this resolves the earlier Linux host blocker

The original Vercel Sandbox runner is Amazon Linux 2023 and its pinned Playwright 1.64 WebKit 2370 binary cannot launch: ICU74, WPEWebKit/GTK, GStreamer/media libraries are absent. Amazon Linux repository metadata did not offer matching WPEWebKit/ICU74 packages. Previous failures are **environment NOT RUN**, not application pass/fail.

An **already-authorized, connected Windows desktop** instead provided Node **24.13.0**, Git and a local Playwright browser cache. We used an **isolated temporary shallow clone of the public repository**, with the exact GitHub checkout ref. No unrelated workspace files were read or modified and no visible browser windows were opened. Node `npm ci` was run locally, followed by installation of optional test tools `playwright-core@1.64.0` and `axe-core@4.11.0` into the temporary clone. A **headless WebKit 27.2** executable (Playwright revision **2370**) was installed in the standard local browser cache and successfully launched and closed. No Vercel/GitHub Actions CI, paid cloud host or upgrade was required.

## Independent Windows bug found and fixed

The initial clean Windows run on previous `main` had **220/221 Node tests** passing. The sole failure, `tests/offline-http-smoke-source.test.mjs`, invoked the local script via a file URL's `.pathname`. On Windows, that becomes `/C:/... ` and is interpreted by Node as `C:\\C:\\...`, yielding `MODULE_NOT_FOUND` instead of the expected fast fail-closed public-origin rejection.

**Fix:** use `fileURLToPath(new URL('../scripts/smoke-http-offline.mjs', import.meta.url))` to obtain a native absolute filesystem path; additionally assert the resolved script exists before testing invalid destinations. This **does not change any application runtime, API, auth, rate limit, Redis or Vercel deployment behavior**. It makes the security test executable and meaningful on Windows.

Retest from executable SHA `7bd062d30bec50fb83ecca1ad031a14b75816a46`:
- **221/221 Node tests PASS on Windows**; the formerly failing offline public/Preview-origin rejection test now executes the intended command and passes.
- `npm run typecheck` PASS.
- `npm run build` PASS (Next.js 15.5.27), all **five** `/api/public-*` dynamic routes built.
- `npm run inspect:budget`: **6 chunks, 434,005 raw / 125,406 gzip bytes**, under raw 537,600 and gzip 163,840 caps. The few-byte difference versus prior Linux build is build-platform specific and remains under limit.
- Built Next production server bound only to **127.0.0.1** on a temporary high localhost port. `npm run smoke:http:offline`: **16/16 PASS** (HTML homepage plus invalid query inputs for five APIs). No intentionally valid repository request was sent.
- `NEXUS_BROWSER_ENGINE=webkit npm run test:browser:manual`: **11/11 PASS**, actual engine **WebKit 27.2** using browser headless on Windows:
  1. 320px text-only 200% enlargement.
  2. 320px text-only 400% enlargement.
  3. 320px complete/narrow UI and F01–F05.
  4. 375px complete/mobile UI and F01–F05.
  5. 768px complete/tablet UI and F01–F05.
  6. 1280px complete/desktop UI and F01–F05.
  7. 1440px complete/wide UI and F01–F05.
  8. 375px partial Actions source/unavailable state.
  9. 1280px incomplete seven-day UTC trend (chart/inference suppressed).
  10. 375px rapid repo selection race, stale responses safely ignored.
  11. 375px invalid duplicated share link, **0** API calls.

All browser scenario outputs report `axeViolations:0`, `pageErrors:0`, `blockedExternalOrigins:0`; all five application APIs were **intercepted by the fixture runner** before Next, Redis or GitHub. The script enforces loopback-only base URLs, blocks external browser origins, never sends a valid Upstash data-plane request, and does not inspect the user's SSO browser sessions.

**Limitations:** This is the WebKit implementation packaged for Windows, not Apple Safari itself; it cannot prove platform-specific iOS Safari rendering, keyboard/VoiceOver/NVDA assistive-technology announcements, color/contrast signoff by a human, true protected Preview authentication, real GitHub data correctness or any real Redis cross-instance behavior. Automated axe checks at A/AA cannot replace G05 screen-reader review.

## Release gates after R3

| Gate | State |
| --- | --- |
| R3 actual pinned WebKit automated engine/fixture regression | **DONE_OFFLINE: 11/11 PASS** |
| R1 Windows secure test entrypoint + Node/build | **DONE_OFFLINE: 221/221 + build/typecheck** |
| R5 local five-API invalid input smoke | **DONE_OFFLINE: 16/16; zero Redis or GitHub** |
| G03 latest deployed protected Preview | **Older executable SHA `2b5fb7c...` READY**; this new source is not deployed |
| G04 real SSO, F01 export artifact, F03 navigation and F04 click evidence | **PARTIAL_REAL_BROWSER_EVIDENCE; OPEN** |
| G05 actual Safari/iOS device and NVDA/VoiceOver/human editorial acceptance | **OPEN** |
| G06 independent Vercel Function Redis budget enforcement | **OPEN** |
| G07 Production exact-SHA authorization | **NOT AUTHORIZED** |

The test is reproducible without any paid tier on a supported headless Windows system. Continue to distinguish **automated WebKit PASS** from human Safari/iOS/assistive-tech acceptance. Do not automatically deploy a new Preview or Production due to this QA documentation change.
