# G04 — Mobile-ready copyable API evidence with zero extra origin requests

**Date:** 14 October 2026.  
**Project:** `senanurcetin/nexus-devops-intelligence`.  
**Exact executable code SHA:** `56c23805a55ec553d1e08a8d1e0451c01efc5e66`. Later commits on this PR change only documentation.  
**Status:** **SOURCE/OFFLINE QA PASSED**; **not yet deployed** to the existing protected Preview. G04 authenticated status acceptance remains **OPEN**.

## User problem addressed

The owner successfully opened the previous protected Preview on desktop and iPhone Safari, but could not locate browser DevTools → Network and did not capture `/api/public-*` response headers. Prior PR #70 added a native `Request diagnostics · no new requests` disclosure with safe, strictly allowlisted status, CDN cache class, shared Redis mode/source based exclusively on **already-received** Actions and PRs responses. These diagnostics were **code-only**, not on the existing deployed Preview.

This follow-up adds a visible **`Copy safe diagnostics · no API requests`** button within that disclosure. Safari, desktop and screen reader users can collect a small client-side evidence receipt without F12, a new API route, analytics or a permission for additional origin traffic.

## Data minimization and failure behavior

The copyable report is produced by a pure source adapter `formatPublicPanelDiagnosticReport`. It contains exactly five fixed lines: a label, Actions' allowlisted response status/cache/admission/limit-source values or “no HTTP response observed”, equivalent PR values or absent response, a statement that generating the report makes **0 API requests**, and an explicit qualification that this does **not** prove SSO authentication, original GitHub source integrity, two Vercel function instances, or a Redis 429.

Report content includes **NO** query strings, repo URLs, deployment domains, credentials, header names outside the allowlist, raw HTML/payloads, session cookies, Authorization values, client IPs, log messages or source names. Receipt fields are sanitized in the existing `safePublicPanelReceipt` function before report construction. Aborted requests and network exceptions have no fabricated status. No status is claimed where no `Response` existed.

On a secure origin with clipboard write permission, the button invokes a **direct browser clipboard write** and confirms success only after the promise resolves. If clipboard access is absent, forbidden or fails (including Safari privacy restrictions), it displays an **accessible readonly textarea** containing the exact safe report for manual selection/copy. No browser permission bypass, hidden upload, telemetry, local storage or remote endpoint was introduced. The button is disabled until at least one source response has been received.

Opening/copying this disclosure **never calls `fetch`**, auto-refresh, redis, GitHub API or Preview. Existing `refreshPanel` and `load` clear any previously shown copy status/fallback after a fresh source selection so old receipt data is not mistaken for the new repository. The report should only be interpreted for the exact version the owner actually visited; screenshots of old Preview cannot establish the new feature is live.

## Source-only evidence

Exact code SHA `56c23805a55ec553d1e08a8d1e0451c01efc5e66` in an isolated Node24 Vercel Sandbox **using an explicitly loopback-only fixture server**, not Preview or Production:

- `npm ci` PASS, **227/227 Node tests** PASS (3 new formatter secrecy/no-invented-status cases).
- TypeScript PASS, Next production build PASS, compiled Next loopback **16/16** invalid-source HTTP contracts PASS.
- Playwright Chromium **11/11**, Firefox **11/11** offline F01–F05 fixture scenarios PASS. The 375px test opens the diagnostics and invokes copy; it asserts the report is copied or a readonly fallback is provided and that **the total API GET count is unchanged**.
- No browser JS uncaught errors, external-origin requests, or reported automated axe A/AA violations.
- Six JS chunks **435,475 raw / 125,780 gzip bytes** under the existing 537,600 / 163,840 source budget.
- `npm audit --json`: **0** reported vulnerabilities in the inspection.
- **No** real NEXUS Preview/Production app-origin requests, Redis commands, SSO session reads, paid features or hosted CI.

**Crucial limitation:** this is source-level evidence on the exact code SHA above. Existing deployed protected Preview `dpl_9sq98XLM2DZAgyBFZoFVUde2NucT` runs *older* app SHA `2b5fb7c379bd1f939f3b50f286edfb868ddb386a`. The new copy button and the earlier diagnostics disclosure are **not** present on that previous Preview. A new authorized, security-compliant exact-SHA SSO Preview deployment is required for user-facing acceptance, but the earlier retry was blocked by platform safety control and **must not be bypassed**.

## Remaining work

- G04: Real authenticated exact-SHA protected Preview acceptance of initial statuses and origin request budget, F01 file integrity, F03 share/history, F04 opt-in, F05 partial UTC trend.
- G05: Owner's iPhone Safari visual/basic smoke was positive; automated WebKit on Windows 11/11; actual VoiceOver/NVDA assistive-technology and screen-reader acceptance unverified.
- G06/#7: Independent **two live Vercel instances** sharing a Redis counter and actual Redis-source 429 are not proven; the offline-only CLI was separately hardened by PR #73 to deny unapproved origin GETs and never call a same-client 429 “G06 PASS”.
- G07: Production remains on older, known READY SHA `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf`; no Production deployment approval exists.

**Decision:** Valuable nontechnical G04 evidence collection improves; it remains **not real release or SSO proof** until the newer protected Preview is actually deployed and observed.
