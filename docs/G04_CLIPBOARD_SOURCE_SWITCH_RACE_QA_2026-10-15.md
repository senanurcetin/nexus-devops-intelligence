# G04 — Stale Safari clipboard evidence after repository switch

**Date:** 2026-10-15 · **Repository:** senanurcetin/nexus-devops-intelligence only.
**Verified executable SHA:** `0de5188030e234f90dcba9a6d19500c649931b7a`.
**Status:** SOURCE/OFFLINE QA PASS; real authenticated G04 acceptance remains OPEN.

## Defect and change

The NEXUS page aborted old API fetches after selecting a different public GitHub repository, but three async clipboard handlers (copyDiagnostics, copyRepositoryLink, copyEvidenceLink) previously set copied/fallback UI state unconditionally after awaiting the browser's writeText promise. Safari clipboard permission or a slow browser may defer resolution until after repository A has been replaced by B. The result can be a misleading success notice or an old diagnostic fallback textbox under the new source selection. This is a user-evidence consistency issue, not proof of an actual Redis or privacy breach.

The source now increments a lightweight copyEvidenceGeneration counter on each panel refresh and invalid repository clearing. Every clipboard handler captures both the counter and selected repository before awaiting; both success and rejection update the UI only if both still match. It does not change the clipboard's already-written bytes, public API routes, origin quota, GitHub requests or security headers. No dependency, local storage, analytics or paid service added.

## Browser regression

The persistent local Playwright suite adds the twelfth fixture scenario **stale-safari-clipboard-switch-mobile** (375 px). A deterministic pending mock browser clipboard promise is started on repository A, repository B is selected, the old promise resolves, and the UI is verified to show neither a stale success nor a fallback. The reverse rejected-promise case is also tested with a Safari-style permission error after switching back to B. Four source selections create exactly 8 fixture-intercepted Actions/PR panel requests, 0 opt-in evidence/trend APIs, 0 nonlocal origins. No actual OS clipboard, Preview, Upstash or GitHub network accessed.

## Exact-source QA (isolated Node24 localhost-only sandbox)

| Check | Result |
| --- | --- |
| Node tests | **227/227 PASS** |
| TypeScript and Next.js production build | **PASS** |
| Local invalid-input HTTP smoke | **16/16 PASS** |
| Chromium fixture scenarios | **12/12 PASS** |
| Firefox fixture scenarios | **12/12 PASS** |
| Browser axe/page errors/external-origin attempts | **0 reported** |
| JavaScript bundle | **435,794 raw / 125,850 gzip bytes**; under raw 537,600 / gzip 163,840 limits |
| npm audit | **0 vulnerabilities** |
| WebKit twelfth scenario on current SHA | **NOT RUN** — authorized Windows desktop WebKit host offline |

Earlier 11/11 headless Windows WebKit PASS is genuine but belongs to an older application/source SHA; it must **not** be promoted to a 12/12 pass on this branch. Browser fixture results are simulated source calls, not live SSO, Redis multi-instance, or actual Apple Safari/VoiceOver evidence.

## Remaining hard gates

- G03/G04: protected Preview still runs previous deployed SHA `2b5fb7c379bd1f939f3b50f286edfb868ddb386a`; newer safe-copy and this race fix are source only, with authenticated F01–F05 acceptance still open. Do not bypass past platform-protection denial.
- G05: real iPhone Safari basic smoke accepted by owner on old Preview; NVDA/VoiceOver/human screen reader still unverified and current twelfth WebKit test not run.
- G06/#7: independently identified pair of live Vercel functions and real Redis-attributed shared 429 not demonstrated, and owner's old permission excluded 21-request live Redis stress.
- G07: Production remains prior READY SHA `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf`; a new Production release requires separate exact-SHA authorization.

**Conclusion:** source-level stale clipboard UI evidence risk fixed; no production/live acceptance falsely claimed.