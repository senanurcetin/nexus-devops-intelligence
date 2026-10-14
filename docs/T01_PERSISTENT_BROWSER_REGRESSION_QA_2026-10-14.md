# T-01 — persistent F01–F05 browser regression (CI-free)

**Date:** 14 October 2026 (Europe/Istanbul)  
**Source verified:** `b9d9ecbad8f4b0364d3549f4424fec690dfa4fc9` (before this documentation-only record).  
**Scope:** six deterministic **real Chromium** browser sessions against a **localhost Next.js production build**; all five public API routes intercepted with in-process GitHub-shaped, source-validated fixtures. **NOT a Vercel Preview/Production, real GitHub API/Redis, Safari or human screen-reader acceptance.** No Actions/CircleCI workflows were created, dispatched or run.

## Reproducible manual execution

Requires Node.js 22.16+ and a machine or ephemeral cloud sandbox with Chromium's shared libraries and basic fonts. The optional browser tools are **not added to `package.json` dependencies or the lockfile**, so the normal npm install and hosted CI policy remain unchanged.

```bash
npm ci --no-audit --no-fund
npm test
npm run typecheck
npm run build
npm run inspect:budget
npm install --no-save --package-lock=false playwright-core@1.64.0 axe-core@4.11.0
npx playwright-core install chromium
# Terminal 1:
npm run start
# Terminal 2:
npm run test:browser:manual
```

The browser command accepts `NEXUS_BROWSER_BASE_URL=http://127.0.0.1:3000/` or another **loopback HTTP** origin (e.g. port 3004). Public Vercel Preview/Production hosts, URL credentials, paths, fragments and query strings are rejected before browser launch. Optional `NEXUS_CHROMIUM_EXECUTABLE` selects a previously installed local Chromium binary.

**Ephemeral Amazon Linux 2023 test host:** the default image lacks Chromium shared libraries and fonts. During QA, temporary sandbox packages were installed with administrator privileges: `nspr nss atk at-spi2-atk alsa-lib libX11 libXcomposite libXdamage libXext libXfixes libXrandr mesa-libgbm libxkbcommon libxcb dbus-libs at-spi2-core fontconfig dejavu-sans-fonts liberation-fonts`. These are **sandbox-only** OS packages; no change to NEXUS Production/runtime. The browser bundle was installed under the temporary sandbox's Playwright cache.

## Persisted scenario matrix

| Browser session | Width | Verified effect | Number of intercepted NEXUS API GETs |
| --- | ---: | --- | ---: |
| Complete integrated F01–F05 | 375 | 2 initial panel GETs; real CSV+JSON native downloads; source and CSV formula neutralization; clicked PR checks/reviews + failed workflow jobs/steps + complete seven-day UTC trend; toggle/cache; repository switch/Back with stale details removed | **9** |
| Same complete integrated journey | 1280 | Same identity, budget, exports, details, UTC days and history navigation | **9** |
| Independent partial source (Actions 503, PR 200) | 375 | JSON/CSV export contains verified PR only; Actions is null, no stale Actions metadata, no detail fanout | **2** |
| Incomplete UTC data returned | 1280 | Trend endpoint called **only by user**; incomplete coverage renders **no seven-day table/chart**; switch/Back identity remains correct | **9** |
| Source race with delayed old responses | 375 | Begin with two actual outstanding source GETs, switch immediately to another repository; old responses cannot override new data; no implicit detail requests | **4** |
| Duplicate `?repo` parameter | 375 | Invalid share URL rejected; export disabled, **zero API requests** | **0** |

Each session asserted **0 uncaught page JS errors, 0 horizontal document overflow and 0 automated axe WCAG 2/2.1 A/AA violations** at its width. The browser interception blocked off-origin navigation and rejected unrecognized API routes; service workers were disabled to prevent bypassing fixture responses. GitHub data was generated using the application’s real `summarizePublicActions`, `summarizePublicPullRequests`, `summarizePublicPrVerification`, `summarizePublicRunEvidence`, and `summarizePublicWorkflowTrend` functions, not arbitrary JSON fields.

**Re-run evidence:** after race test synchronization, **all six scenarios passed in two consecutive independent full Chromium runs** against the unchanged built application. The race test now waits for both initial repository GETs to begin *before* switching; the previous early-click variation was not a source-response race. This is a fixed harness precondition, not a claim that the app has universal race immunity.

## Additional accessibility semantic repair

The two user-expanded evidence detail containers now have `role="region"` with existing meaningful `aria-label` identifiers for the selected PR and failed workflow run. This makes their evidence discoverable to role-based browser/accessibility queries instead of being unlabeled generic containers. Chromium/axe retests passed, but **human NVDA/VoiceOver acceptance remains open**.

## Exact-source code-quality checks

- `npm ci --no-audit --no-fund` passed on a disposable checkout; optional browser dependencies installed with `--no-save --package-lock=false`.
- **189/189** Node tests passed (includes the new public/Preview URL-denial regression).
- TypeScript `tsc --noEmit` and production Next.js build passed.
- Local page JS **431,890 raw / 124,794 gzip bytes** (six chunks), below existing **537,600 raw / 163,840 gzip** caps.
- Full `npm audit --json` found **0** low/moderate/high/critical vulnerabilities at inspection.
- No live GitHub/Upstash requests made by browser journeys; **0 preview/production deployments**.
- Browser sessions were disposable and generated no secret-bearing screenshots. Unlike the older ephemeral integrated runner, the executable test **is committed as a reusable source file**, and the manual command is versioned.

## Still open

- [x] **T-01:** Repeatable, source-safe browser regression and real-browser proof; CI-free.
- [ ] **T-02:** Editorial visual refinement and device-derived, SHA-labeled real screenshots; tested widths are not human design signoff.
- [ ] **G-02:** Owner inspection of actual aggregate Upstash Free usage and Vercel Hobby capacity.
- [ ] **G-03/G-04:** Owner-authorized new exact-SHA SSO-protected Preview and real authenticated runtime/browser/network acceptance.
- [ ] **G-05:** Human NVDA/VoiceOver, macOS/iOS Safari and physical mobile acceptance.
- [ ] **G-06:** Actual independent Vercel serverless Redis origin enforcement, tracked in [#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7).
- [ ] **G-07:** Separate, explicit Production approval; old Production code remains deployed.

**Limitations:** This test verifies browser behavior under controlled API fixtures, not real request timing, GitHub rate-limit health, shared Free Redis acceptance, external links opened on GitHub, full WCAG conformance, cross-browser support or a production SLA. Never interpret a passing fixture chart as a measure of a real repository.
