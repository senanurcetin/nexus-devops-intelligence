# NEXUS DevOps Intelligence — remaining development and release backlog

**Status snapshot:** 13 October 2026. This file is the **current authoritative open-work register**; the older [cumulative work plan](NEXUS_WORK_PLAN_2026-10-13.md) records chronological decisions and may contain superseded unchecked tasks (for example, Preview Redis variables have since been configured). Check each external state again before executing.

## Verified baseline — do not confuse implementation with release

| Boundary | Latest verified evidence | Not yet accepted |
| --- | --- | --- |
| GitHub `main` | `7b116ea5d754deba1bee55b01e7bb745fe4c4116`, containing Actions sample intelligence PR #31, PR intelligence PR #32 and executive layout PR #33 | Latest app has not been viewed on actual updated Vercel Preview/Production |
| Manual app QA | 121/121 Node tests, TS/build, 0 npm audit findings at inspection, real read-only GitHub HTTP smoke; Chromium 320/375/768/1280/1440/1920 with deterministic fixtures, no automated axe A/AA violations | Human visual/physical device/NVDA/VoiceOver/Firefox-WebKit signoff |
| Production Vercel | `dpl_9fXGATNHhyhNVrN1i47k3BU4u5K5`, READY, source `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf` | New GitHub fixes/design **not** released |
| Protected Preview | `dpl_DxFyywkhBrMe3hzooikmqCpKAuyx`, READY, source `e745c6188f47942ffe8405aa195d7584e2d395da` | Preview is behind `main`. New exact-SHA Preview needs explicit owner authorization |
| Preview & Production Redis | Two Redis REST env **names** scoped `Production + Preview`, `Sensitive`; successful **single actual Preview** response with `x-nexus-rate-limit-mode:shared-redis` on cache MISS | Both environments share owner-confirmed **Upstash Free EU-CENTRAL-1** database/budget; live cross-instance quota proof not established |
| Offline Redis acceptance | Actual local Redis 6, two independent Next.js processes, shared 20 admitted GETs + 21st Redis-attributed 429, separate IP allowed, **0 Upstash commands** | This is **not** proof of two independent Vercel serverless function instances |
| Rate limiting | Redis-authoritative **origin** admission code merged; Vercel Hobby WAF remains **Log only** | No Vercel edge/CDN DDoS mitigation or verified Production shared Redis enforcement |
| Manual acceptance issues | [#5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5), [#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) both OPEN | Neither should be closed based on automated tests or a README claim |

## Non-negotiable execution constraints

- **Only** `senanurcetin/nexus-devops-intelligence`. Do not change other repositories, emails, projects or unrelated Vercel resources.
- **NO hosted CI:** no GitHub Actions, CircleCI or Git-triggered deployment. Use isolated disposable Vercel Sandbox, manual `npm test`, `npm run typecheck`, `npm run build`, audit, HTTP smoke, and browser QA. Clean up sessions.
- **NO paid features**, plan upgrades, or unapproved external service usage. Do not read, export, decrypt, print, copy or share secret values.
- **NO 21-request live Redis load test** or other shared-Upstash quota stress on Production/Preview. The owner explicitly declined because Preview and Production share the same Free database; use offline simulations and existing safe telemetry. Any future alternate live acceptance requires a **new explicit agreement**.
- **NO Production or protected Preview redeployment without owner approval.** Pin the reviewed commit SHA. Keep Vercel SSO protection enabled for Preview and `git.deploymentEnabled:false`; do not assume SSO protects public custom domains.
- Never call a fixture result real customer/repository performance; never call a clean merge state actual merge approval; never claim human accessibility or Vercel cross-instance security signoff from local testing.

## P0 — release and operational safety gates (must be resolved or explicitly deferred by owner)

| ID | Task | Acceptance / evidence | Dependency | Owner |
| --- | --- | --- | --- | --- |
| **R-01** | Source / release manifest | Record selected immutable commit SHA, deployed SHA, deployment IDs, SSO scope, public-domain expectations, rollback candidate and any source drift. No moving-`main` release. | None | Developer |
| **R-02** | Review Upstash **aggregate** Free consumption | Owner checks commands used/remaining, storage and alert levels in dashboard; document dates/aggregate values only, no REST keys. Do not assume or hard-code the current resource allowance. | Owner can see billing/usage UI | Owner + developer |
| **R-03** | Protected Preview of current reviewed code | **Only after explicit approval**, manually deploy pinned latest candidate to a **SSO-protected Preview** with Preview-scoped Sensitive variables. Verify source SHA and protection first, do not disable protection or affect public Production. | R-01, owner release authorization | Developer |
| **R-04** | Actual Preview visual and functional acceptance | Review latest code at its real protected Preview URL on 320/375/768/1280/1440/1920; form errors, partial failures, source links, filters, navigation, console, hydration, no overflow. Save screenshots and compare to reviewed designs; count origin requests conservatively. | R-03 | Developer + owner |
| **R-05** | Accessibility and cross-browser manual signoff ([#5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5)) | Perform complete keyboard/focus order, live-region behavior, actual NVDA or VoiceOver and at least one physical mobile browser; Firefox/WebKit as feasible. Record evidence and explicit owner/editorial acceptance; axe alone insufficient. | R-04 | Owner/manual tester |
| **R-06** | Origin Redis / WAF risk decision ([#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7)) | Keep current offline two-process real Redis proof and live **one-request** Preview reachability proof distinctly labeled; live independent Vercel instances remain unverified. Seek provider evidence not consuming owner quota, or an owner-approved separate no-cost test resource **if actually available**. If neither is available, leave the security gate open; owner may separately choose to accept the documented residual risk, not falsely mark test passed. Verify WAF **Log only** and distinguish origin rate limit from edge protection. | R-02, optional explicitly authorized alternate proof | Developer + owner |
| **R-07** | Rollback-ready manual Production release | **After explicit Production approval**, confirm source SHA, verify build and smoke, review Free quota and domain/SSO state, record previously working deployment; manually deploy selected SHA, verify real public endpoint/retry/rollback path using a tightly bounded, pre-approved request budget. No automatic release. | R-01/R-04/R-05 and R-06 resolved or recorded owner risk acceptance | Developer + owner |

## P1 — remaining code reliability and quality fixes (do before proposing release)

**Q-04 implementation / browser-QA update (13 Oct 2026):** [PR #36](https://github.com/senanurcetin/nexus-devops-intelligence/pull/36), merge `a49275a1bb1e324859c66b68ef50b7849821b1b9`, fixed long unbroken source evidence overflow and clipped workflow titles, including auto-fit source tiles and zoom-safe CSS. CI-free **132/132** tests, TS/build, audit 0 at check, read-only GitHub smoke; controlled long-content Chromium **320/375/768/1280/1440px**, **320px + 200% text-only zoom**, and **1280px + 400% text-only zoom**: no document overflow, browser exceptions or axe A/AA violations. **Residual scope remains:** 320px + 400% additional text-only zoom overflow, Firefox/WebKit, native browser zoom, human NVDA/VoiceOver and real-device/editorial signoff remain unverified (#5). [Q-04 QA evidence](Q04_VISUAL_REFLOW_QA_2026-10-13.md). Q-05 performance/API budget regression is the next safe code-only package.


**Q-03 progress update (13 Oct 2026):** [PR #35](https://github.com/senanurcetin/nexus-devops-intelligence/pull/35) has completed the offline dual-route error matrix; no live Redis multi-instance enforcement proof was created. Q-04 cross-engine/human and extreme combined zoom acceptance remain open; Q-05 performance budgeting is still pending.

**Progress update (13 Oct 2026):** Q-01 is implemented and manually verified; Q-02's currently identified stale-request, independent error and targeted-retry scenarios passed controlled Chromium QA. Broader unmount/timer/race edge coverage may be added as follow-up. Q-03 was completed in PR #35. See [PR #34](https://github.com/senanurcetin/nexus-devops-intelligence/pull/34).



| ID | Task | Required change or investigation | Done when |
| --- | --- | --- | --- |
| **Q-01** | Source-specific freshness and partial-success semantics | The dashboard currently has **one** `lastApiResponseAt` set on either Actions or PR success. Separate receipt times and/or stale/available badges **per panel**; avoid presenting one successful response as freshness of both. | Correct load, error and retry timestamps; test with one panel failing while the other succeeds; zero new source GETs |
| **Q-02** | Deterministic async/race regression | Existing Chrome fixtures covered delayed old repository requests; add repeatable tests for rapid repository selection, per-panel retry while another response is in flight, aborted requests and unmount cleanup. | Old repo cannot overwrite new, no orphan timers, both retry paths maintain data isolation |
| **Q-03** | Error/read-only contract matrix | Revalidate invalid input, 404, upstream 429, own origin 429, Redis-unavailable 503, 5xx, malformed JSON, network aborts and no-store/security headers, using **offline mocked HTTP** and limited anonymous real smoke. | Typed errors and Retry-After preserved, no raw upstream/secret leakage, no unexpected GitHub fanout when Redis configured/unavailable |
| **Q-04** | Real visual and interaction QC across browsers | Check long PR titles, long repo names, 320px menu, 200%/400% text zoom, reduced motion, empty/source errors, responsive card heights and evidence links; use screenshots/DOM geometry. | No overlapping/truncated controls, focus visible, usable accessible text, human screenshot review tracked separately |
| **Q-05** | Performance and budget regression | Monitor browser bundle, client hydration, large list rendering (bounded sample), request counts per new selected repo, Actions/PR retry fanout and Free origin quotas. Avoid requiring a live Redis stress test. | No unplanned API calls, no new paid services, before/after bundle diff and manual reproducibility |

## P2 — optional product enhancements after P0/P1 (review each separately)

| ID | Feature | Correctness guard / cost gate |
| --- | --- | --- |
| **F-01** | Client-side **CSV/JSON export** of the *currently verified sample*, including repository and retrieval-time metadata | Sanitize filenames/cells (spreadsheet formula injection), never export tokens; clearly label at most 10 runs / 5 PRs; **0 new network calls** |
| **F-02** | Improved investigation workflows: source provenance, severity explanation and copyable GitHub deep links | Deterministic descriptions only; keep sample/unknown distinctions and no writes to GitHub |
| **F-03** | Optional repository shareable view / remembered selection | Validate public `owner/repository` strictly; do not expose credentials, query arbitrary URLs or auto-repeat expensive requests |
| **F-04** | Real per-PR checks and reviews / detailed workflow failure context | **Not currently in the API model.** Requires new GitHub REST calls with explicit anonymous rate-limit and Upstash budget review. Do not fabricate branch staleness, required-review status or failure root cause from `mergeable_state`. Can defer if no safe budget. |
| **F-05** | Historical trends / cross-run reliability analytics | **Not supported by the existing 10-run sample.** Only add if a documented, budget-reviewed pagination/time-window source exists; otherwise preserve categorical sample composition and avoid a bogus trend line |

## P3 — design acceptance, docs and operations

| ID | Task | Acceptance |
| --- | --- | --- |
| **D-01** | Visual editorial acceptance | Actual screenshots of reviewed Preview across core breakpoints; designer/owner approves spacing, brand identity, charts, navigation and dark-theme accessibility. Current screenshot automation is **not** owner approval. |
| **D-02** | Canonical evidence/status register | Prevent stale checkboxes in the original cumulative log from implying Preview credentials are missing or old tests are undone. Distinguish **Implemented / Tested offline / Verified in Preview / Released / Human accepted / Deferred**. |
| **D-03** | Release handoff | Concise setup, no-secret environment name matrix, Hobby/Upstash free-budget note, deployed-SHA inspection, manual smoke, failure response, safe rollback and incident contacts. |
| **D-04** | Bounded operational monitoring | Monitor meaningful deployment SHA, read-only API errors and cost/quota warnings without repeated quota-intensive probes. Avoid false uptime claims, paid monitoring or broad log/secret dumps. |

## Execution order — concrete PR-sized batches

1. **Batch A (completed in GitHub):** Q-01 + Q-02 implemented through [PR #34](https://github.com/senanurcetin/nexus-devops-intelligence/pull/34), merge `4a6c19f4f3a4a249fcb0ac401c1b29e90489b04c`: independent validated Actions/PR browser-local receipt times, source-only refresh and failed-only retry, no stale former-repository results after rapid selection. Manual sandbox 121/121 tests, TS/build, audit 0 and read-only HTTP smoke; actual 375px Chromium delayed-request / partial 503 / single-source retry scenarios and automated axe A/AA 0 violations. **Not deployed.** [QA details](PANEL_SOURCE_RECEIPTS_QA_2026-10-13.md).
2. **Batch B (Q-03 completed; Q-05 pending):** [PR #35](https://github.com/senanurcetin/nexus-devops-intelligence/pull/35), merge `cfe367fc3f9055c96d6b5b9911d5b11aa7cce797`, hardened the browser-visible public error allowlist and verified both actual Next routes with eight **offline** Redis/GitHub failure-matrix tests: safe 400, shared Redis 429, Redis-unavailable 503/no upstream work, GitHub-attributed 429, malformed upstream 502, timeout 504, WAF HTML/Retry-After sanitization; **129/129** tests, typecheck/build, zero npm-audit findings at inspection and real public GitHub read-only HTTP smoke. **Zero actual Upstash commands** in the matrix. [QA runbook](OFFLINE_API_ERROR_MATRIX_QA_2026-10-13.md). Q-05 budget/performance regression remains open.
3. **Batch C (implemented; human acceptance open):** Q-04 long-label/reflow fixes merged in PR #36 and fixture-based Chromium QA documented; Firefox/WebKit and extreme combined zoom pending, and **D-01 human editorial review on actual protected Preview** still requires separate explicit deployment authorization.
4. **Batch D (usability):** F-01 (sample export) + F-02 (clear evidence/provenance UX), one focused PR per feature.
5. **Batch E (operator readiness):** R-01, R-02, D-02/D-03; agree explicitly on protected Preview source SHA and release acceptance constraints.
6. **Batch F (manual release, owner-gated):** R-03 → R-04 → R-05 → R-06 → R-07. This is not an instruction to deploy automatically.
7. **Future, conditional:** F-03/F-04/F-05 only if feature benefit, API budgets and data correctness justify the extra scope.

## Definition of done

- **Engineering-ready:** all changes in reviewed PRs; full CI-free Node suite, typecheck, production build, npm audit, read-only HTTP smoke and controlled browser checks pass; no unexpected quota, security or usability regressions.
- **Preview-ready:** exact tested commit SHA is manually deployed to a **protected** Preview with explicit owner permission; source, SSO, env scopes, origin request budget, and screenshots are verified.
- **Production-ready:** owner signs off human accessibility/visual QA and the **documented residual Redis/edge risk** is accepted or independently addressed; owner authorizes exact-SHA manual production release and rollback.
- **Released:** production SHA matches the approved candidate, public-domain behavior is observed without credentials and a bounded smoke/rollback check is recorded. GitHub merge alone is **not** a release.

**Status:** All P0 release gates are **open or partial**. No Preview/Production redeployment or live 21-request Upstash probe is authorized by this document.
