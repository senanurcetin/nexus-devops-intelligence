# T-02 — NEXUS editorial visual quality and responsive QA

**Date:** 14 October 2026 (Europe/Istanbul)  
**Exact tested source (application + fixture runner):** `67a7d1b838c088e6a615967454b332530934a70e`. Subsequent documentation-only changes do not alter that application source.  
**Status:** Visual-system engineering and local Chromium verification **completed**; **human aesthetic review, Safari/real devices and protected live Preview are still open**. See [release plan](NEXUS_CURRENT_RELEASE_WORK_PLAN_2026-10-14.md) and [Issue #49](https://github.com/senanurcetin/nexus-devops-intelligence/issues/49).

## Design and evidence requirements

| Component | Before / observed defect | Implemented solution and observed constraint |
| --- | --- | --- |
| F-01–F-05 evidence/sample charts | 15px-high Actions/PR categorical strips are too small; colour carries too much meaning | 25px-high grouped categorical strips, deliberate separation and in-context **count + percentage** cells; categories/counts unchanged, no estimates inferred |
| Actions/PR legend | Numeric summaries/labels have weak surface hierarchy | Nine legible metric cells (4 run conclusions / 5 PR buckets), strong tabular numerals, source-linked run/PR tiles |
| F-05 seven UTC days | `~9px`-high tracks and a 290px minimum six-column table crowd values | **17px** daily tracks, `680px` internal scrollable table, readable numeric columns, sticky date header/column, row divisions; **incomplete coverage still suppresses the entire daily data matrix** |
| Metadata and source hierarchy | Several provenance/section labels measured around 10–11px at default root font | Increased metadata, chart/kicker and section label size to around 12–13px; NEXUS blue/teal/coral/amber state semantics preserved |
| 320px / 400% simulated text-only zoom | During additional test, body `scrollWidth=467` with a 320px viewport; over-wide CSV/JSON and trend buttons and long section labels | Responsive button wrapping/flex-width controls, section label wrapping, and `overflow-x:clip` on mobile root to prevent a sticky scrollable command navigation from widening the document; **final automated 320px zoom tests pass at 200% and 400%** |
| On-demand detail panels | Long source information might crowd the mobile view | Existing F-04 evidence panels retain `role=region` labels, wrapping, and explicit user-triggered fetches; all integration flows reverified |

**No design decision changes a GitHub rate limit, backend API, Redis admission, source sample cap, calculation, data identity, export semantics, authorization, or URL boundary.** Graphs show the actual sampled counts, not a simulated reliability/SLA forecast.

## Exactly reproduced, CI-free

An ephemeral Node.js 24 sandbox on Amazon Linux 2023 was given Chromium dependencies/fonts and the *optional* local Playwright Core/axe tools. No hosted GitHub Actions, CircleCI or Vercel Preview/Production deployment.

1. `npm ci --no-audit --no-fund` passed (clean checkout).
2. `npm test`: **189/189 passed**.
3. `npm run typecheck`, `npm run build`: passed.
4. `npm run inspect:budget`: **6 page JS chunks, 432,115 raw / 124,819 gzip bytes** against existing 537,600/163,840 byte limits; this is **page JS only**, not CSS or a network performance score.
5. Built local CSS: **50,898 raw / 11,012 gzip bytes** (local build measurement; not a separately enforced CSS budget).
6. `npm audit --json`: **0** reported info/low/moderate/high/critical vulnerabilities at check time.
7. `NEXUS_BASE_URL=http://127.0.0.1:3012 npm run smoke:http:offline`: **6/6** root/invalid-route HTTP assertions, zero intentionally valid GitHub or Redis calls.
8. `NEXUS_BROWSER_BASE_URL=http://127.0.0.1:3012/ npm run test:browser:manual`: **11/11 Chromium sessions passed in TWO independent complete runs**, including default UI at **320, 375, 768, 1280, 1440 CSS pixels**, 320px simulated 200%/400% text-only enlargement, missing-source/partial export, incompletely enumerated UTC dates, rapid-source-switch stale-data race, and duplicate share-link rejection.
9. Every browser session: **zero unhandled page JavaScript errors, zero entire-document horizontal overflow, zero automatically detected axe WCAG 2/2.1 A/AA violations**, and the expected bounded number of locally intercepted GETs. In 400% zoom, the command navigation retains *its own* horizontal scrolling and all three CSV/JSON/trend controls stay within the 320px viewport.
10. **17 locally generated SHA-tagged PNG screenshots** were captured across the above scenarios, including the expanded UTC matrix. The PNGs are **ephemeral QA artifacts in the disposable sandbox**, not committed/linked image deliverables and **not visually signed off by a human**. Screenshot creation is permanently repeatable using the committed runner.

### Reproduce/screenshots

```bash
npm ci
npm install --no-save --package-lock=false playwright-core@1.64.0 axe-core@4.11.0
npx playwright-core install chromium
npm run build
# Shell A
npm run start
# Shell B
NEXUS_BROWSER_CAPTURE_DIR=./qa-captures npm run test:browser:manual
```

The script rejects Preview/Production URLs and other non-loopback origins, blocks external requests, intercepts **all five app API routes** with deterministic source-validated fixtures and blocks service workers. No live GitHub/Upstash admission or billing claim follows from the fixtures. SHA-stamped screenshots and JSON summary logs support a **separate manual editorial acceptance**; the reviewer should inspect legibility, composition, 320px reflow and whether samples have sufficient epistemic disclaimers.

## Still open / do not silently mark passed

- **Editorial sign-off:** The implemented CSS was tested by geometry, screenshots and automated axe, but no user/human-design review of the images is established; keep visual acceptance separate from engineering verification.
- **Safari/WebKit, actual phone, NVDA/VoiceOver and real OS/browser zoom:** Root-font-size enlargement in Chromium is a *simulation*, not OS-level or cross-browser acceptance.
- **Release G-02–G-07:** Actual aggregate Upstash Free usage; owner-approved exact-SHA SSO-protected Preview; authenticated live F01–F05 acceptance; independent Vercel instance Redis enforcement (#7); human mobile/a11y QA; separate Production approval.
- The old protected Preview remained on `599ced7` and Production on `74cd0e3` at last inspected deployed-version check. This task created **no deployment**.

No source screenshots in this document should be mistaken for data from the actual repository: all Chromium records were generated by strictly bounded test fixtures.
