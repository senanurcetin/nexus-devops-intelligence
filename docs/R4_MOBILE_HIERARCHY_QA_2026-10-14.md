# R4 — NEXUS mobile editorial density and source-provenance QA

**Inspection:** 14 October 2026 (Europe/Istanbul)  
**Project:** senanurcetin/nexus-devops-intelligence only.  
**Exact checked-out, compiled and browser-tested source SHA:** 2efaefcc27c8fafe8c5f2534ac34f3f59cd35f13.  
**Status:** source-local visual improvement complete; independent human aesthetic, real Safari/iPhone, screen-reader and protected Preview acceptance **OPEN**. No new Preview or Production deployment.

## Concrete problem and fix

The **old** NEXUS-branded 375px fixture screenshot on GitHub main d9c6cd76714fab8d86ee4040171603c960493dd6 placed almost the entire first 900 CSS-pixel viewport in the brand hero plus its long, repeated "limited preview" panel. The "Public GitHub repository" query began below the first viewport, pushing the application's primary task further down. The mobile repository sharing note was also squeezed into a half-width text column.

The change intentionally preserves the NEXUS blue/navy/teal palette, hero masthead, meaningful source-provenance copy, the two source-loading statuses and receipt times while optimizing vertical information hierarchy:

- Mobile 320–640px: shorter **accurate** read-only product description and less redundant heading/badge text; compact hero gutters and typographic rhythm; no chart or dataset distortion.
- Visible source coverage remains precise: **up to 10 workflow runs / up to 5 open PRs**, potentially pending merge states; no token, AI diagnosis, account-wide spend or deployment claim.
- **Both source receipt timestamps** remain visibly named Actions and PRs and explicitly use **browser local time**; neither panel's status nor the partial/failed retry button is removed.
- Mobile report/share explanatory text now stacks below the source-sharing button at **full width** rather than narrowing to an awkward side column.
- The URL, source filters, request counts, GitHub/Redis clients, F01–F05 data semantics, dashboards, charts, trend classification and public APIs remain unchanged.
- Add **actual Playwright geometry regression** at 320/375px for hero size, first-screen query access, source boundary copy, the two receipts and full-width sharing guidance. This is not merely a screenshot assertion.

## Source-local screenshot and geometry evidence

Screenshots produced in a disposable CI-free Node24/Amazon Linux Vercel Sandbox with browser-intercepted, static fixture sources. Before: full screenshot d9c6cd7 at 375px. After: updated 375px screenshot with sample limits and received-at timestamps still visible, repository input and analyze button visibly much earlier in document flow. These fixture screenshots were inspected in the working session, **not** a human editorial signoff and not evidence of current deployed Preview.

Separately verified under intentionally **failed-source fixture** (two intercepted local HTTP 503 responses, no real GitHub/Redis), which *adds a live retry control* and is therefore a conservative taller mobile-state check:

| Viewport | Hero top | Hero height | Repository search top | Full document width | Browser origin API requests |
| --- | ---: | ---: | ---: | ---: | ---: |
| 320px | 136px | 732px | 886px | 320px | 2 fixture intercepted |
| 375px | 100px | 636px | 754px | 375px | 2 fixture intercepted |
| 768px | 105px | 645px | 782px | 768px | 2 fixture intercepted |
| 1280px | 121px | 421px | 574px | 1280px | 2 fixture intercepted |

Note: these measurements refer to the **source failure** presentation, not the full loaded-state screenshot. The loaded-state screenshot visibly places the 375px repository input in the initial viewport. Automated browser assertions for loaded-state 375px use hero <=700px and search top <=850px; 320px allow hero <=790px and search top <=970px to avoid hiding content at narrow widths. Both widths test sample limit, receipt identity, and share description width; standalone 320px 200%/400% simulated root-font enlargement tests still run. Do not describe simulated font enlargement as actual physical Safari browser zoom.

## Exact-SHA engineering validation

Checked-out code SHA **2efaefcc27c8fafe8c5f2534ac34f3f59cd35f13** on a disposable Node24 sandbox:

- npm test: **205/205 pass**, zero failures.
- npm run typecheck: PASS.
- npm run build: PASS.
- npm run inspect:budget: **6 page JS chunks; 432,228 raw bytes / 124,819 gzip**, within caps **537,600 / 163,840**.
- npm audit --json: **0 info/low/moderate/high/critical findings** at this inspection.
- NEXUS_BASE_URL=http://127.0.0.1:3042 npm run smoke:http:offline: **16/16** loopback HTTP, zero intentionally valid GitHub/Upstash API requests.
- NEXUS_BROWSER_BASE_URL=http://127.0.0.1:3042 NEXUS_BROWSER_ENGINE=chromium npm run test:browser:manual: **11/11** Playwright Chromium 156.0.8078.4 fixture scenarios PASS.
- NEXUS_BROWSER_BASE_URL=http://127.0.0.1:3042 NEXUS_BROWSER_ENGINE=firefox npm run test:browser:manual: **11/11** Playwright Firefox 157.0 fixture scenarios PASS.
- Automated axe WCAG2/2.1 A/AA violations: 0 in tested fixture sessions. No page-overflow, uncaught JS page errors or unexpected external browser network calls in the successful regression runs. **Human assistive-technology tests are not implied.**

The **CSS and JSX** affect only layout and explanatory copy; no account consumption, Redis secrets, live GitHub reads or credential-access commands were part of the QA.

## Remaining plan gates

- **R4 human design/brand review**: still open for real mobile Safari/physical device and signed-off screenshots, additional partial/empty/error states; engineer's source-local visual pass cannot supply human approval.
- **R3 WebKit**: Playwright WebKit has **not** launched in the available Amazon Linux 2023 sandbox because it requires ICU74/GTK/GStreamer/Flite. A compatible host run with the identical pinned 11-scenario fixture suite remains needed; this does not certify Apple's Safari. [T03 QA](T03_CROSS_ENGINE_WEBKIT_QA_2026-10-14.md).
- **R2/G02**: shared Upstash Free + team Hobby actual usage unknown; no live probes.
- **R6/G03**: protected exact-SHA Preview not deployed; G04 real data acceptance open.
- **R8/G05**: human Safari/iPhone/NVDA/VoiceOver/visual acceptance open.
- **R9/G06/#7**: two real Vercel instances' Redis admission not evidenced.
- **R12/G07**: separate Production approval required.

No paid services, hosted CI, auto-deploy, public Preview exposure, Production aliases or Redis load test were changed.