# WebKit cross-browser QA — manual CI-free verification

**Date:** 13 October 2026  
**Repository:** `senanurcetin/nexus-devops-intelligence`  
**Source tested:** `fix/accurate-workflow-conclusions` commit `c94d72c4952988721ca80f64a0c842ca4f49684c`, squash merged via [PR #10](https://github.com/senanurcetin/nexus-devops-intelligence/pull/10).  
**Environment:** Temporary Vercel Sandbox, Node 24/npm 11, Linux Ubuntu 26.04, Next.js `next start` on local HTTP, no CI runner.

## Browser and tooling

- **Playwright WebKit 27.2**, build `2370`; `playwright-core@1.64.0`.
- `axe-core@4.11.0`, temporarily installed; not added to production or development dependencies.
- WebKit browser binary and Linux host dependencies were installed only within the temporary cloud sandbox.
- Both `/api/public-actions` and `/api/public-prs` were replaced with deterministic HTTP 503 JSON responses for this browser experiment; real GitHub API smoke checks were conducted separately.

## Verification results

| Check | 375 px | 768 px | 1440 px |
| --- | --- | --- | --- |
| Homepage HTTP status | 200 | 200 | 200 |
| Document width / horizontal overflow | 375 / none | 768 / none | 1440 / none |
| Landmarks | 1 `main`, 1 `h1` | 1 `main`, 1 `h1` | 1 `main`, 1 `h1` |
| Invalid repository validation | Correct owner/repository warning | Pass | Pass |
| Keyboard Tab reaches Analyze button | Pass | Pass | Pass |
| Focus outline on Analyze button | Solid | Solid | Solid |
| Uncaught page JavaScript errors | 0 | 0 | 0 |
| axe-core WCAG 2/2.1 A/AA automated violations | **0** | **0** | **0** |
| axe-core rules passed | 24 | 24 | 24 |

## Additional live public GitHub browser test

After the deterministic form/axe checks, WebKit was retested at **375px and 1440px** with **unmocked public GitHub API responses**. The browser waited for the initial React application to hydrate before submitting `vercel/next.js`.

- Both viewports received HTTP 200 and eventually displayed `Selected: vercel/next.js`.
- Both viewports exposed **20 GitHub source links** under the selected public repository.
- No page JavaScript errors, API error banners, or horizontal overflow were observed.
- An initial test that submitted before hydration timed out; waiting for page network-idle/interactive readiness resolved the test issue. This was a test sequencing problem, not evidence of an application defect.
- Real mobile and desktop screenshots were captured inside the temporary cloud sandbox. **The sandbox expired before they could be transferred to GitHub, so no screenshot assets are claimed as committed.** Screenshot publication remains a separate documentation task.

This is a live-read-only browser smoke test, **not a Vercel public deployment**, WAF test or comprehensive cross-browser certification.

## Interpretation and remaining limits

The primary form and baseline error-state layout were manually exercised in **three browser engines across the project**: Chromium, Firefox, and Playwright WebKit. These checks provide browser-engine coverage but do not prove compatibility with every Safari release/device.

- A zero-violation axe scan does **not** certify complete WCAG conformance.
- Human NVDA/VoiceOver screen-reader examination and a complete keyboard-only workflow are still outstanding.
- The controlled API errors here are **mocks**; a public Vercel preview URL was not exercised.
- The rate-limiting WAF configuration, pricing approval, deployment-level access controls and preview remain outstanding in [issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7).
- No GitHub Actions, CircleCI or Git-based automatic deployment was configured or triggered.
