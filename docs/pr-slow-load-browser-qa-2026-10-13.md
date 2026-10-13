# NEXUS — PR slow-load UX and bounded concurrency QA

**Date:** 13 October 2026  
**Branch:** `feat/pr-slow-load-feedback`  
**Execution:** Temporary Vercel Sandbox; production `next start` on localhost; no hosted CI, public Vercel deployment, WAF change or user-machine setup.

## User-facing change

- After **2.5 seconds of the current PR request still loading**, the PR panel displays a clear, non-blocking message: NEXUS is still waiting for GitHub PR details and checks at most two at a time to reduce API load.
- The corresponding accessible `role=status` message announces that PR checks are taking longer. The already-independent Actions panel remains available.
- When PR data or an error arrives, the slow-load hint clears. A new repository selection or PR refresh resets the hint and its timer; old requests cannot show the warning or overwrite the new repository.
- **This is client-side feedback, not an estimate, progress percentage, retry or deadline.** No new GitHub calls or timers that trigger a fetch.

## Reproducible latency measurement (controlled fixture, not a production SLO)

Manual Node.js measurement against the unchanged, **two-worker** PR-detail adapter using a fixture with five valid non-draft PRs:

| Artificial delay per detail GET | Measured total adapter time | Maximum concurrent detail GETs | Upstream calls |
| --- | ---: | ---: | ---: |
| 80 ms | **243 ms** | 2 | 6 (one list, five details) |
| 160 ms | **482 ms** | 2 | 6 (one list, five details) |

Each measurement demonstrates roughly **three waves** of detail calls (two + two + one). They are controlled mocked GitHub responses and include adapter/test-runtime overhead, not measurements of real GitHub or the deployed product. Maximum individual GitHub GET timeout still applies; slow external calls can extend the complete analysis.

## Manual Chromium UI checks

Using Playwright Core and Chromium from the **temporary sandbox**, with deterministic intercepted public API responses:

| Scenario | 375px mobile | 1440px desktop |
| --- | --- | --- |
| Homepage | HTTP 200 | HTTP 200 |
| Actions returns quickly, PR mock delayed 3.6s | Actions remains readable | Pass |
| Slow PR hint after 2.5s | Appears with `aria-busy=true` | Pass |
| Screen-reader `role=status` | Announces longer GitHub wait | Pass |
| PR response settles | Hint disappears, `aria-busy=false` | Pass |
| Replace repository while old PR is delayed | No old hint or stale result | Pass |
| Horizontal overflow / uncaught JS errors | None / none | None / none |
| axe-core 4.11 WCAG 2/2.1 A/AA | **0 automated violations**, 25 passes | **0 automated violations**, 25 passes |

A `5.4s` old-repository mocked PR response was scheduled during the race; the browser correctly preserved the newly selected repo and did not show the old-repo slow message or result.

## Other manual verification

- Clean `npm ci --no-audit --no-fund`: passed
- `npm test`: **67/67 passed**; `npm run typecheck`: passed; `npm run build`: passed
- Full `npm audit --json`: **0 findings** at verification time
- `npm run smoke:http`: passed using real public GitHub sources, including 10 sampled Actions runs, 5 sampled open PRs, invalid repository 400/no-store and security headers

Browser scripts and injected axe-core were used for **manual** QA and not added to tracked package dependencies.

## Explicit limitations

- A delayed PR result can still be slow; the new hint **does not** shorten or retry upstream calls.
- Measured fixture latency is **not** a real network performance guarantee.
- Automated accessibility scans do not substitute for human NVDA/VoiceOver examination: [issue #5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5).
- Platform-wide WAF and Hobby pricing approval are still outstanding: [issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7).
- No GitHub Actions, CircleCI, auto-deploy, public preview or WAF activation was performed.
