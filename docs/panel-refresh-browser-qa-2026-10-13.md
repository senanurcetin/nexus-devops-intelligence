# Independent panel refresh — manual QA

**Date:** 13 October 2026  
**Source branch:** `feat/independent-panel-refresh`  
**Scope:** Public read-only Actions and PR dashboard panels, no workflow execution.

## User-visible improvement

- Every source panel has its own keyboard-focusable, labeled refresh button (`Refresh GitHub Actions` and `Refresh pull requests`).
- Retrying a failed Actions request **does not refetch or erase** a successful PR panel, and vice versa.
- Each panel has its own `aria-busy` state and screen-reader-friendly loading/done announcement.
- Switching repositories aborts and supersedes both old panel requests. A delayed response from a prior repository cannot overwrite the new source.
- A refresh is a **direct user-initiated** read-only fetch; no background retry, timers or CI trigger were introduced.

## Temporary cloud validation

- `npm ci --no-audit --no-fund`: passed
- `npm test`: **59/59 passed**; `npm run typecheck`: passed; `npm run build`: passed
- Full `npm audit --json`: **0 findings** when checked
- `npm run smoke:http`: passed (homepage + security headers; invalid repo 400/no-store; actual public GitHub workflow and PR sample requests)

## Interactive Chromium

Both **375px** and **1440px** viewports passed a manually initiated Playwright/Chromium smoke with **mocked read-only API responses**:

1. Initial Actions HTTP 503 yielded its independent alert while PRs loaded successfully.
2. Clicking `Refresh GitHub Actions` triggered exactly one additional Actions request; the PR count stayed at **one** and its loaded content remained visible.
3. Clicking `Refresh pull requests` triggered exactly one additional PR request without changing the Actions request count.
4. During a subsequent delayed Actions refresh, selecting a new repository replaced the old source. The delayed old response did **not** appear for the new repository.
5. No horizontal overflow or uncaught browser JavaScript errors in either viewport.
6. axe-core 4.11 automated WCAG 2/2.1 A/AA rules: **zero violations** with 25 rules passing in each viewport.

Temporary Chromium, Playwright and axe packages were installed in a cloud sandbox for manual QA only, not committed as dependencies. The mocked browser runs are separate from live GitHub HTTP smoke; no public preview URL was used.

## Still open

- Human NVDA/VoiceOver inspection and full manual keyboard journey: [issue #5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5).
- Platform-wide WAF rule, account pricing approval, and manual Vercel preview release: [issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7).
- No GitHub Actions, CircleCI or automatic deployment was executed.
