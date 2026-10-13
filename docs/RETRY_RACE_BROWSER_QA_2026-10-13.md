# Targeted retry and stale-response verification (2026-10-13)

**Scope:** NEXUS DevOps Intelligence browser reliability and free-tier request conservation. Tests ran manually against a temporary local production build in an isolated **Vercel Sandbox**. The API handlers in the browser fixtures were intercepted by Playwright; **those fixtures are not represented as real GitHub data**. The separate `npm run smoke:http` test used real read-only public GitHub endpoints.

## Change

The shared status card previously called `load(selectedRepo)` whenever **either** the Actions or PR panel failed. That function requested **both** API routes, resetting even the successful panel and consuming unnecessary anonymous GitHub and Upstash Redis origin admissions. It also discarded the previous successful-response timestamp.

Now the retry action calls `refreshPanel('actions', selectedRepo)` only for an errored Actions panel and `refreshPanel('prs', selectedRepo)` only for an errored PR panel. If **both** panels failed, both are retried. Accessible labels identify the individual failed panel, while the existing `Retry both GitHub source panels` label is preserved when both need recovery. The existing abort-controller generation checks remain intact. New selection still uses `load(repo)` and refreshes **both** panels.

## CI-free verification

| Manual check | Evidence |
| --- | --- |
| Clean `npm ci`, `npm test` | **96/96 passed** after adjusting the brand source-contract assertion to enforce the new retry behavior |
| `npm run typecheck`, `npm run build` | Both passed |
| `npm audit --json` | **0** reported vulnerabilities (at verification time) |
| `npm run smoke:http` | Homepage 200, both invalid-input APIs 400/no-store, real public GitHub Actions and PR samples returned expected read-only data |
| Only PR panel failed (simulated HTTP 503) | 375 and 768px: Actions **1** request; PR **2** requests after one explicit retry. Successful Actions panel remained loaded |
| Only Actions panel failed (simulated HTTP 503) | 375 and 768px: Actions **2** requests; PR **1** request after one explicit retry |
| Both panels failed | 375 and 1440px: **2** requests to each after one explicit combined retry |
| Repository switch mid-request | At 375 and 1440px, deliberately delayed both API responses for `owner/first`, immediately requested `owner/second`; only `SECOND ACTION` and `SECOND PR` were visible after delayed responses completed. Four requested cross-repository fixtures were independently counted, so this tests a real request generation race |
| Browser errors, overflow | **0 page exceptions**, no document horizontal overflow in tested scenarios |
| Axe-core WCAG 2/2.1 A/AA | **0 automated violations** at **375 / 768 / 1440px**, with **26 passed rules** per viewport |

For browser testing, `playwright-core`, `@sparticuz/chromium` and `axe-core` were installed **only in the disposable sandbox**, with platform system dependencies. They were **not** added to app dependencies. Chromium's single-process build occasionally closed after the first page, so subsequent browser scenarios were run in separate fresh Chromium processes instead of silently marking them passed.

## Release and acceptance boundaries

- No GitHub Actions/CircleCI or automatic Git-triggered Vercel deployment was used.
- No Upstash credentials were read; the Vercel project's **Production-only Sensitive** variables remained untouched. **Preview** still lacks Redis variables, so no Redis-enabled protected preview was claimed.
- Merging this change **does not deploy it to production**. Issue [#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) stays open pending real Redis cross-instance enforcement with the correct deployed SHA and free-tier acceptance.
- Issue [#5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5) stays open until **human NVDA/VoiceOver and real-device visual approval**. Axe and Playwright are necessary automation, not a substitute for human acceptance.
