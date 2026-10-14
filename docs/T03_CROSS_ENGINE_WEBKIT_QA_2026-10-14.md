# T-03 — Cross-engine browser regression and WebKit host assessment

**Date:** 14 October 2026 (Europe/Istanbul)  
**Repository:** `senanurcetin/nexus-devops-intelligence`  
**Exact executable source SHA:** `d67d2b839c0ffa6ccbdf65a1521a1ba7035dc6cc`. Following documentation changes are not application/runner changes.  
**Result:** **Firefox + Chromium source-local regression verified; WebKit/Safari NOT verified.**

## What the engineering change does

The existing `scripts/manual-browser-f01-f05.mjs` now accepts `NEXUS_BROWSER_ENGINE` with exactly `chromium` (default), `firefox`, or `webkit`. It uses **the same 11 scenarios, the same locally intercepted API fixtures, the same source SHA tag, the same axe-core A/AA checks, and the same external-network refusal** on all engines. Unsupported values fail before the browser starts; no fallback to Chromium is performed if explicitly selected Firefox/WebKit fails. Screenshot filenames include the actual selected engine to prevent false attribution.

Firefox/WebKit contexts omit Chromium-only clipboard permission grants. The script still blocks service workers, denies non-loopback URLs and never sends legitimate application API requests to a live Vercel/GitHub/Upstash endpoint.

The tests verify F-01 CSV/JSON downloads (including CSV formula neutralization); F-02 source-linked investigations and sample counts; F-03 source switching and Back/Forward; F-04 click-to-fetch check/review/job evidence; F-05 seven completed UTC days with partial-data suppression and no duplicate fetch on reopen; missing Action data; stale-race suppression; duplicate source link rejection; 320/375/768/1280/1440 CSS-pixel widths; and 200%/400% **simulated root-font enlargement**.

## Reproduced, exact-SHA evidence

Execution used a **disposable Node.js 24 Vercel Sandbox running Amazon Linux 2023**, NOT a deployed Vercel Preview/Production instance; with public git source and optional manual browser dependencies `playwright-core@1.64.0`, `axe-core@4.11.0`. Firefox host packages `gtk3`, `pango`, `cairo-gobject`, `gdk-pixbuf2`, `libXcursor` were installed in this ephemeral sandbox (not project package dependencies).

| Verification | Result |
| --- | --- |
| Clean `npm ci` / TS / Next production build | **PASS** |
| `npm test` | **205 / 205 PASS** (includes explicit unsupported browser engine rejection) |
| `npm run inspect:budget` | **6 page JS chunks, 432,115 raw / 124,819 gzip bytes**, within budget |
| `npm audit --json` | **0 vulnerabilities** at inspection |
| `npm run smoke:http:offline` on port 3024 | **16 / 16 HTTP checks PASS**, no intentionally valid GitHub/Redis calls |
| `NEXUS_BROWSER_ENGINE=chromium npm run test:browser:manual` | **11 / 11 PASS**, reported Playwright Chromium **156.0.8078.4** |
| `NEXUS_BROWSER_ENGINE=firefox npm run test:browser:manual` | **11 / 11 PASS**, reported Playwright Firefox **157.0** |
| Independent repeat, Firefox | **11 / 11 PASS** again |
| `NEXUS_BROWSER_ENGINE=webkit npm run test:browser:manual` | **NOT RUN — browser launch blocked (exit 1)**; missing host libraries described below |

For each successful Chromium and Firefox scenario: zero unexpected JS page errors, zero whole-document overflow, zero axe-core WCAG 2.0/2.1 A/AA violations **as detected automatically**, and zero unexpected external browser requests. All five NEXUS API routes were intercepted with local source-verified fixture data. **No real GitHub or Upstash commands were intentionally issued.**

### WebKit hard blocker (do NOT mark Safari as accepted)

`npx playwright-core install webkit` fetched the WebKit browser binary, but **Amazon Linux 2023 is not Playwright's fully supported WebKit runtime** for these pinned browser artifacts. Actual `webkit.launch()` failed before any page tests: missing `libgstreamer-1.0.so.0`, `libgtk-4.so.1`, `libicudata.so.74`, `libicui18n.so.74`, `libicuuc.so.74`, Flite media libraries and more. Amazon Linux 2023 offered installed ICU **67.1**, not the required **74** for this build. Installing the remaining unrelated system libraries or symlinking incompatible ICU ABIs would be unsupported; no false “success” claim is made.

**Remaining WebKit acceptance:** rerun the same version-pinned runner on a compatible Ubuntu/macOS/Windows host with `npx playwright-core install webkit` and the provider-recommended browser system dependencies, then record engine version, fixture results and screenshot provenance. Even a passing Playwright WebKit run is **not the same as real iOS Safari**, VoiceOver, pinch/browser zoom, mobile visual signoff or authenticated Vercel Preview acceptance. Human G-05 checklist and source-approved protected Preview G-03/G-04 stay open.

## Manual reproduction (zero valid external API calls)

```sh
npm ci
npm install --no-save --package-lock=false playwright-core@1.64.0 axe-core@4.11.0
npx playwright-core install chromium firefox webkit
npm run build
# terminal one
npm run start
# terminal two (POSIX)
NEXUS_BROWSER_ENGINE=chromium npm run test:browser:manual
NEXUS_BROWSER_ENGINE=firefox npm run test:browser:manual
NEXUS_BROWSER_ENGINE=webkit npm run test:browser:manual
```

On Windows PowerShell, set `$env:NEXUS_BROWSER_ENGINE="webkit"` followed by `npm run test:browser:manual`; Windows dependencies/installed browsers still must be compatible. Optional PNG captures can be produced using `NEXUS_BROWSER_CAPTURE_DIR` and include the engine name and exact git SHA.

**Do not use public Preview, Production, a custom domain or any network-facing URL as the test origin.** The runner rejects them. No hosted CI, paid tier, GitHub Actions, CircleCI, Production alias, SSO bypass, live Redis probe, or new Vercel deployment was used.

## Remaining release gates

- **G-02:** real shared Upstash Free usage and aggregate Vercel Hobby metrics unknown; offline calculator exists but is not authorization.
- **G-03–G-04:** new source is NOT deployed to signed-in SSO Preview, so no real authenticated source/UI evidence.
- **G-05:** independent WebKit/Safari/iPhone/VoiceOver and human design signoff **OPEN**. Firefox + Chromium source-local checks are a meaningful engineering regression, not cross-device certification.
- **G-06 / Issue #7:** actual independent Vercel-function-instance shared Redis admission **OPEN**.
- **G-07:** Production launch separately unauthorized.

