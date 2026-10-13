# Independent NEXUS panel loading and edge rate-limit QA

**Verification date:** 13 October 2026  
**Branch:** `feat/accessible-panel-resilience`  
**Method:** Manual CI-free Vercel Sandbox, Node.js 24, npm 11; Playwright Core and Chromium installed only in the temporary sandbox. No GitHub Actions, CircleCI or automatic Vercel deployment.

## Changes

- Extracted public browser response processing into `src/lib/nexus-panel-request.ts`; added six offline unit tests.
- GitHub Actions and PR panels now render their respective results as each request finishes, rather than waiting for both.
- Cancelled/stale requests are ignored after a repository switch.
- When the Vercel WAF returns an HTTP 429 HTML body, the interface displays a safe and specific retry message instead of an HTML/JSON parsing exception.
- Added screen-reader-friendly per-panel loading and completion status announcements.

## Manual verification

| Check | Observed result |
| --- | --- |
| Fresh `npm ci --no-audit --no-fund` | Passed |
| Node.js unit and Next route tests | **39 / 39 passed** |
| `npm run typecheck` | Passed |
| `npm run build` (Next.js 15.5.27) | Passed |
| Full `npm audit --json`, including dev dependencies | **0 vulnerability entries** at verification time |
| Chromium 375, 768, 1440px | Homepage HTTP 200, no horizontal overflow or uncaught JS errors |
| Controlled Actions 503 + delayed PR 429 | Actions error became visible **before** PR finished; PR panel remained `aria-busy=true` |
| WAF response body was HTML rather than JSON | PR panel showed `Request limit reached. Please try again shortly.` |
| Search input | Accessible label found, keyboard focusable, submission button remained enabled |
| axe-core 4.11 WCAG 2/2.1 A/AA automation | **0 violations** at 375, 768 and 1440 px in the mocked error-state flow; 24 rules passed per viewport |

The earlier Tailwind 4 contrast audit also found zero automated violations at 375px and 1440px in the regular dashboard. This check specifically covered **simultaneous failure/loading states** with deliberately mocked external API responses.

## Remaining work / limitations

- The result demonstrates no observed regressions in the tested Chromium modes; it is not a complete accessibility conformance certificate. Human screen-reader, comprehensive keyboard-only and Firefox/WebKit tests are still pending.
- Vercel's process-local request gate does not provide cross-instance rate limiting. The platform WAF release blocker remains [issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7).
- The test never deployed a publicly accessible URL and never made GitHub Actions or CircleCI calls.
