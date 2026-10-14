# F-01–F-05 integrated regression & pre-release QA — 14 October 2026

**Scope:** NEXUS DevOps Intelligence GitHub `main` source `9414a382e3d223cde83550ad49beea402926db8f`, plus **five new cross-feature Node contract tests** in this QA branch. **NO Preview or Production redeployment. No hosted CI, actual Upstash command or live GitHub API smoke.**

## Cross-feature risk coverage

The important new risk after F-01–F-05 merged is **state and source correctness across features**, rather than whether each individual function passed isolated tests. The test matrix explicitly exercised one Next production build in the same Chromium session with every NEXUS API response intercepted by controlled fixtures.

| Journey | Browser resolution and observation |
| --- | --- |
| **Integrated all features, Chromium 143, 375px** | Open `?repo=owner%2Fone`; **exactly two initial panel GETs**. Copy canonical repository URL; download and parse actual **CSV and JSON** (both contain verified source and formula-neutralized PR/run names). Copy PR source deep link to and read from real Clipboard API. Explicitly open one PR checks/review detail, one failed Actions run job/step detail and one complete seven-day UTC table: **exactly three extra, user-triggered detail GETs**. Collapse/reopen all three without new detail GETs. Switch to `owner/two` (two panel GETs) and verify the old PR/run/trend disappear; browser Back to `owner/one` causes only two panel GETs, **not** hidden detail calls. **9 API requests total** as expected. No page overflow, uncaught JS error or automated axe WCAG A/AA violation. |
| **Integrated all features, Chromium 143, 1280px** | Same end-to-end sequence and **9 expected GETs**, correctly downloaded and parsed two files, no stale cross-source detail, no overflow/JS errors/axe A/AA violations. |
| **One-source 503, Chromium 143, 375px** | Actions unavailable while PR panel succeeds. Source-state message remains partial, CSV/JSON export only the **verified PR** with no Actions sample metadata, and share link contains only public `repo`. Switch to a different repository and use Back without extra detail requests. **6 expected panel API GETs** total; no misleading Actions export, overflow, JS errors or axe A/AA violations. |
| **Rapid source change with delayed old responses, Chromium 143, 375px** | Initial `owner/one` Actions and PR routes deliberately delayed; switch to `owner/two` while old requests are pending. After old responses have settled, only `owner/two` remains selected, with no old run title or F-04 detail buttons. Exactly four requested panel URLs (two per repository), **zero automatically triggered F-04/F-05 requests**; no JS errors or automated axe A/AA violations. |

**Browser fixture limitation:** all NEXUS `/api/public-*` calls were intercepted in Chromium; these tests did **not** use real Vercel Preview, Production, shared Upstash, or GitHub REST. The browser runner was an ephemeral local script, and its running Sandbox stopped before its source could be archived. Therefore the browser cases are an **observed manual QA record**, not a committed, directly replayable browser test suite. The persistent follow-up consists of five added pure **Node cross-feature contract tests** in `tests/nexus-f01-f05-integrated-contract.test.mjs`. These use repository-validating actual summarizers/exporters and F-02 recommendation / F-04 PR and run evidence / F-05 coverage validators; they deliberately reject old-repo data, partial source misuse and fabricated time-series coverage.

## Fresh reproducible code and Redis evidence

New feature branch `qa/f01-f05-integrated-regression-20261014` at commit `fa448d9fccdac9549dbdae33f7bf7cd16114a0db`, on a separate disposable Node 24 Vercel Sandbox:

| Check | Actual observation |
| --- | --- |
| `npm ci --no-audit --no-fund`; `npm test` | **187 / 187 passing**: all pre-existing 182 tests plus **5 new integration contracts** |
| `npm run typecheck`, `npm run build` | **Passed**; all five existing public API route groups build; no runtime application change |
| `npm run inspect:budget` | 6 page JS chunks, **431,862 raw / 124,789 gzip bytes**; under existing **537,600 raw / 163,840 gzip** caps |
| `npm audit --json` | **0 vulnerabilities** at inspection time |
| `npm run test:redis:offline` | Real **Redis 6.2.20**, two **different Node process IDs** with actual Next.js Actions/PR handlers sharing atomic Redis `EVAL`: **first 20 concurrent origin requests = 200**, **21st = 429 shared-redis**, second test IP = 200, **22 real local EVAL commands**, **0 live Upstash commands**, **0 Preview/Production requests** |
| Public GitHub direct smoke | **NOT rerun**. Previous anonymous upstream smoke yielded HTTP 429; no further consumption of shared GitHub quotas is justified by this offline pass. |

Local cross-process Redis proof remains distinct from actual independent **Vercel serverless instance** enforcement, Free-tier quota accounting and paid/edge WAF behavior. GitHub [issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) was confirmed **OPEN** during this QA. The historically **CLOSED** [issue #5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5) must **not** be read as human accessibility acceptance; its manual Safari/NVDA/VoiceOver/physical-device steps remain unverified in the release ledger.

## Release decision and hard gates

This work verifies the **local source-level regression candidate only**. No exact-SHA **authenticated protected Preview** run/visual QA for F-01–F-05 has been performed. Protected Preview remains an older READY version **`599ced76605c25161b182b2d5bfbadbd091bfb53`**, and Production remains older app SHA **`74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf`**. Neither contains F-01–F-05. Accordingly: **not yet accepted for Production release**.

Next independently approved release actions (not executed here): exact-SHA pinned manual protected Preview deployment, authenticated real Preview visual/functional acceptance, human screen-reader/physical-device checks, quota-preserving Upstash/Redis evidence plan, then separately approved Production rollout and rollback proof. The user previously deferred screenshots. **Do not interpret a GitHub merge or CI-free localhost test as deployment permission.**

**No CI/CircleCI, auto-deploy, paid service, secret inspection, SSO/WAF/env modification, synthetic live shared Redis load or new external token requirement.**
