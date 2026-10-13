# PR inspection count correctness — manual Chromium QA

**Date:** 13 October 2026  
**Source branch:** `fix/unknown-pr-attention-count`  
**Scope:** PR inspection tally, distinction between unknown and confirmed merge states; read-only dashboard.

## Defect and remedy

The PR API previously computed `needs_attention` only from `conflict`, `blocked`, `behind` and `unstable` PRs, even though the recommendation engine already identifies an `unknown` PR as requiring verification. The dashboard's **PRs needing inspection** tile therefore understated the number of open PRs needing a look whenever GitHub did not supply a reliable merge state.

A PR with `unknown` now contributes to `needs_attention`. The separate `unknown` and `conflicts` counts and status labels do **not** change: an unverified PR is **not** called a confirmed merge conflict. `draft` and GitHub-reported `clear` continue to be excluded from the metric.

## Manual CI-free verification

- Clean `npm ci --no-audit --no-fund`: passed in temporary Vercel Sandbox
- `npm test`: **78/78 passed**, including two new summary tests and an expanded actual Next.js API route assertion
- `npm run typecheck` and `npm run build`: passed with Next.js 15.5.27
- Full `npm audit --json`: **0 findings** at verification time
- `npm run smoke:http`: passed locally against production build, using real public GitHub workflow (10 sampled runs) and PR (5 sampled PRs) requests

## Controlled interactive Chromium (not real GitHub data)

A manually launched, disposable Chromium/Playwright browser intercepted only the two local read-only API calls with a deterministic fixture:

- 1 PR marked **unknown**, 1 **draft**, 1 **clear**; `needs_attention: 1`, `unknown: 1`, `conflicts: 0`
- **375px mobile and 1440px desktop** rendered the `PRs needing inspection` value **1**
- The three PR state labels remained distinct: **Not verified**, **Draft**, **Clean (reported)**
- No horizontal overflow and **zero uncaught JavaScript page errors** at either viewport
- axe-core 4.11 automated WCAG 2/2.1 A/AA check: **0 violations**, **26 passes** in each viewport

Browser fixture results are not presented as production GitHub accuracy or a human WCAG/screen-reader certification. The independent production HTTP smoke used real GitHub data and is recorded separately.

## Open release gates

- Human NVDA/VoiceOver and real-device keyboard QA [issue #5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5)
- Real enforced platform-wide WAF rate limiting and usage approval [issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7)
- No CI, paid service, Git push auto-deployment, protected-preview publication or public production deployment was performed.
