# G-01 CI-free exact-source acceptance and safe loopback smoke — 14 Oct 2026

**Status:** Verified application source on a disposable Node.js sandbox. **Not deployed, not live GitHub/Upstash tested, not a browser/SSO acceptance.** References: [current work plan](NEXUS_CURRENT_RELEASE_WORK_PLAN_2026-10-14.md), [#49](https://github.com/senanurcetin/nexus-devops-intelligence/issues/49), [#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7).

## Exact tested source

- Baseline `main` from 14 Oct: `965a85dcc51b2a27c7009fea0b0a175e740e2955`.
- Updated application/test branch **tested HEAD**: `111006235550dfc5bdccdcd11077d766711f6ebd`. Includes `scripts/smoke-http-offline.mjs`, the npm command and one additional negative-origin regression test. Later **documentation-only** commits do not change that tested application source.
- Disposable Vercel Sandbox session used **Node v24.14.1 / npm 11.11.0**, 2 vCPU, 4 GiB RAM. Public Git source cloned at exact SHA; no Vercel Preview or Production deployment created and no hosted CI jobs run.

## Measured acceptance

| Check | Exact result |
| --- | --- |
| Baseline `npm ci --no-audit --no-fund` | PASS, clean install |
| Baseline `npm test` | **187/187 passed** |
| Feature branch `npm test` | **188/188 passed** (one extra guard regression) |
| `npm run typecheck` | PASS (baseline and feature branch) |
| `npm run build` | PASS, Next.js 15.5.27 (baseline and feature branch) |
| `npm run inspect:budget` | **6 JS chunks; 431,862 raw / 124,789 gzip bytes**, below 537,600 / 163,840-byte existing limits |
| `npm audit --json` | 0 info/low/moderate/high/critical at both measured check points |
| Local production server, `npm run smoke:http:offline` | **6/6 HTTP assertions passed:** root HTTP 200 with safety headers; all **five** `/api/public-*` endpoints reject malformed repository with **400, no-store, JSON error, nosniff** |
| Negative origin regression | Rejects Production/Preview URLs, public hosts, credentials, paths, query strings, fragments **before any fetch**; passed in Node suite |
| External services used by HTTP smoke | **0 valid GitHub repository calls; 0 Upstash requests**. No cache/admission/multi-instance claims |

The existing `smoke:http` remains the **separate live public GitHub sample** routine. It was **not executed** here: an earlier anonymous GitHub smoke already encountered 429 and further quota-consuming calls were not justified for source-local verification.

## New repeatable command

On a local or short-lived sandbox checkout, run `npm ci && npm test && npm run typecheck && npm run build && npm run inspect:budget`. Start the built server with `npm run start`, then in a second shell run `npm run smoke:http:offline`.

The offline command validates an HTTP loopback origin **only** (defaults to `http://127.0.0.1:3000/`). It deliberately submits only malformed repositories, so route validation stops before GitHub API fanout or shared Redis admission. This is safer for the shared Upstash Free allowance and GitHub's anonymous rate limit. It **does not** prove any successful real GitHub integration, live Redis, F01–F05 browser interactions, Safari/mobile/screen reader behavior, or Preview protection.

## Outstanding gates

- [x] **G-01** — source-local Node/TS/build/budget/audit and bounded offline HTTP verified on exact application SHA `1110062`.
- [ ] **T-01** — a repeatable Playwright/Chromium F01–F05 interactive fixture runner; Node contract tests and six HTTP assertions do not replace browser tests.
- [ ] **G-02** — actual aggregate Upstash Free command/storage usage/headroom.
- [ ] **G-03** — separately authorized manual current-SHA SSO Preview; existing READY Preview still old `599ced7`.
- [ ] **G-04/G-05** — true authenticated Preview UI, real device/Safari, NVDA/VoiceOver editorial signoff.
- [ ] **G-06** — independently attributed real Vercel cross-instance Redis admission, #7.
- [ ] **G-07** — separately authorized Production deployment; current Production remains `74cd0e3`.

No change to production aliases, app protection, runtime secrets, Redis, WAF, CI policy or Ops-Copilot was made.
