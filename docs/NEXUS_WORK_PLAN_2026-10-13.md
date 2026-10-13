# NEXUS DevOps Intelligence — delivery and development plan

**Baseline:** 13 October 2026 · **Execution policy:** CI-free; manual cloud verification; no paid services, automatic Git deployment, or unapproved production release.

## Verified starting point

| Area | Verified status | Source / caveat |
| --- | --- | --- |
| GitHub `main` | `e647baed57d8a4e2e16551d32e3bb0b920c4ceb3` | [Merged PR #25](https://github.com/senanurcetin/nexus-devops-intelligence/pull/25) |
| Latest Vercel production build | `dpl_23cYA6n7AU6eEtxRNqw3oJQFnnWs`, `READY`, commit `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf` | **Not yet using the Redis-authority fix in `e647bae`**; Vercel `READY` alone is not a public-access or security sign-off |
| Public GitHub endpoints | Read-only Actions and open PR summaries with narrow, explicit sample limitations | Invalid repository must be HTTP 400/no-store |
| Redis | Production-scoped **Sensitive** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` were verified as *present*, without reading their values | Free / $0 Upstash plan and remaining quota must be confirmed by owner |
| Shared limiter | PR #24 provides an atomic Upstash IP counter; PR #25 checks it **before** the per-instance fallback | The earlier live 429 could have come from the local limiter; independent post-PR-25 cross-instance proof still needed |
| Existing Vercel WAF | **Log** only; user's Hobby account cannot use premium `Default (429)` | Do not describe it as blocking traffic or attempt paid activation |
| Automatic releases | `vercel.json` sets `git.deploymentEnabled: false` | Manual, specific-SHA deploy only, with release approval |
| CI-free last validation | 90/90 unit/route/security tests; TypeScript and Next.js build; npm audit 0 findings at check time; real public GitHub HTTP smoke; Chromium 375/768/1440, axe A/AA 0 detected violations | This is pre-release code/browser evidence, **not** a current production acceptance certificate |
| Open release issues | [#7 shared rate limit](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) (P0), [#5 manual accessibility/visual acceptance](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5) (P1) | Do not close until the actual acceptance criteria pass |

## Sequence and acceptance criteria

### Phase 0 — P0 release and abuse protection (highest priority)

**P0.1 — Verify the deployment boundary and costs** — **PARTIALLY VERIFIED (external account confirmation pending)**
- Read back exact latest GitHub SHA, Vercel deployment target, host aliases, existing deployment protection and production vs preview environment variable **names only**. Do not read/log tokens.
- Confirm Vercel SSO-protected preview mechanics without lowering protection; confirm user's Upstash plan is **Free / $0**, quota approx. 256 MB, 500,000 commands/month; record actual dashboard values and any limits/auto-upgrade policy.
- Review the last production deployment for live runtime errors and accidental changes from concurrent pushes.
- **Exit:** deployment/rollback SHA and free-cost boundaries documented; no hidden changes to production.

**P0.2 — Verify Redis is authoritative in a protected release candidate** — **PENDING**
- Preserve exact source SHA `e647bae`; no unrelated feature commits in the release candidate.
- If a protected Vercel preview is available, ensure both Redis variables are set as **Sensitive / preview** without exposing credentials; publish **manual preview only**. If a preview cannot safely be configured, do not treat its absence as authorization for public deployment.
- Run read-only, bounded probes: valid Actions/PR GETs, invalid repo 400/no-store, independent panel failure states, shared 20/60s counter, 21st uncached request 429 + Retry-After + no-store, second trusted IP still admitted.
- Distinguish CDN HIT vs MISS and stable IP / region; verify Upstash command count or corresponding Redis-side evidence. For **cross-instance** proof, use two genuinely separate application processes/instances sharing one live Redis counter, or supported provider evidence of inter-instance counter use. A mocked Redis Map or a single-instance 429 is insufficient.
- Check local fallback only when shared Redis is absent; explicitly configured Redis outage produces fail-closed 503 before GitHub calls.
- Monitor upstream GitHub quota and Upstash commands to avoid excessive load or free-tier overages. Stop probing at the first confirmed threshold.
- **Exit:** timestamped verification evidence attributes 429 to Redis on the released SHA, with no quota, disclosure or availability incident; otherwise leave #7 open.

**P0.3 — Controlled rollout and rollback** — **BLOCKED on P0.1–P0.2 + owner approval**
- Re-run fresh `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm audit --json`, `npm run smoke:http` and browser verification manually in a short-lived sandbox.
- Publish only an explicit SHA after user approval; never turn Git auto-deploy back on. Save the previous ready production deployment ID for rollback.
- Post-rollout perform health and 200/400/429/503 checks against the **actual** current production alias; read runtime logs, verify no error increase and no unsupported security claim.
- Roll back if app errors/availability regress or Redis cannot meet free-tier bounds.
- **Exit:** exact deployed SHA, URLs, manual verification records and rollback instructions match; no paid service used.

### Phase 1 — Accessibility, UI and reliability acceptance (next, can work on a feature branch before rollout)

**P1.1 — Real-device and assistive technology sign-off** — **PARTIAL / HUMAN ACCEPTANCE OPEN**
- Repeat 375/768/1440 Chromium, keyboard-only entry/submit/retry, visible focus, responsive overflow, browser console, loading, malformed input, 404/429/5xx/empty states, switching repositories during requests and stale-response cancellation.
- Owner or human QA checks NVDA + supported desktop browser, and/or VoiceOver + Safari on a real device. Record actual focus order, headings, labels, spoken errors and live announcements; do not describe axe as human screen-reader testing.
- Capture actual application screenshots with repository/data provenance; avoid mock data presented as real.
- **Exit:** #5 checklist reviewed with human evidence; fix any observed accessibility bugs and rerun QA. If human verification cannot be performed, #5 stays OPEN.

**P1.2 — Reliability and free-tier operational guardrails** — **BACKLOG**
- Verify upstream GitHub 403/429/5xx handling, bounded PR detail fanout, timeout and `Retry-After`; no secret or IP leak in UI/logs.
- Define a **non-paid**, read-only health and usage review: origin 429/503 counts, error rate, cache HIT/MISS, GitHub anonymous quota failures, Upstash monthly command trend and Vercel Hobby deployment quota.
- Proposed conservative Upstash usage alert at 80% of the published monthly command allowance; confirm observed allowance before hard-coding a threshold.
- **Exit:** reproducible maintenance checklist and clear runbooks; no personal-data capture or new paid telemetry.

### Phase 2 — Product intelligence enhancements (after release gates; implement behind separate reviewed PRs)

**P2.1 — Trustworthy Actions analysis**
- Add clearly labeled, sample-based success/failure/pending trend slices over available public runs; allow understandable filters but never portray a 10-run sample as full historical reliability, spending or billed minutes.
- Keep links to the source run, data timestamps and `unknown` outcomes. No workflow mutations/triggers.

**P2.2 — Actionable PR risk signals**
- Better differentiate merge conflicts, `unknown` GitHub mergeability, draft, stale status and unverified details; preserve human-review disclaimers.
- Link each signal to the exact public PR evidence. Avoid heuristic `merge safe` or AI/automerge claims without a verifiable source.

**P2.3 — Portfolio-grade NEXUS presentation**
- Retain the single navy/sapphire NEXUS palette across views; refine responsive spacing, skeleton/loading states, evidence provenance, empty/error states and readable statistical hierarchy.
- Capture truthful branded screenshots only after actual behavior is verified.

**P2 acceptance:** each feature goes through isolated PR, manually executed tests and responsive accessibility smoke; deploy only after P0/P1 release criteria and human approval.

### Phase 3 — Documentation and handoff

- Keep `README.md`, environment variable setup, **free-tier usage** expectations, `docs/FREE_SHARED_RATE_LIMIT.md`, release gates and the actual deployed SHA aligned.
- Record one CI-free release checklist with exact test commands, screenshots, failures and rollback steps.
- Close #7 and #5 only on verifiable criteria; update related issues instead of marking them done based on code merges.

## Delivery discipline

1. Work in this order: **P0.1 → P0.2 → P0.3 → P1.1 → P1.2 → P2.1 → P2.2 → P2.3 → P3**.
2. Keep P0/P1 quality work separate from P2 feature changes; one issue/PR per logical change, with technical titles and evidence-based descriptions.
3. Keep GitHub Actions / CircleCI **disabled**. Use short-lived cloud sandboxes for reproducible manual `npm`, browser, and security checks, and stop sessions when done.
4. No paid Vercel WAF action, Redis upgrade, new account integrations, exposing secrets, automatic Git release, or production publishing without explicit user authorization.
5. Distinguish `READY` (build status), `HTTP 200` (one tested request), **origin shared 429**, platform WAF protection, and human WCAG acceptance. These are **different claims**.
6. Every iteration ends with: source commit, tests (pass/fail), changed files, release status, remaining blockers and next concrete step.

## Immediate next execution

1. **Free Tier confirmed** on owner console (EU-CENTRAL-1). Monthly consumption/remaining command allowance is still unverified; do not require secrets or upgrades.
2. Verify whether protected preview of pinned `e647bae` is available on the Hobby project. If not, document the blocker and prepare QA evidence without bypassing SSO.
3. Conduct bounded genuine cross-instance Redis attribution test once the **correct code** is deployed with approval.
4. Update issue #7 with measured evidence; begin human/real-device items from issue #5.

### P0.1 execution evidence — 13 October 2026, later session

- [x] Verified Vercel project's exact ID/team, latest production `READY` deployment `dpl_23cYA6n7AU6eEtxRNqw3oJQFnnWs` (SHA `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf`) and rollback candidate `dpl_DbvJfcGmZ5GGnHdb7kuK4wmQRrr5` (`44479f2`). **No release** happened during this plan execution.
- [x] Confirmed `vercel.json` still has `git.deploymentEnabled:false`; the project remains SSO-protected on applicable Vercel deployment URLs using `deploymentType: all_except_custom_domains`. Authentication-protected URLs are not a substitute for human/public-URL signoff.
- [x] Confirmed only **Production** has `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, both of type **Sensitive**. The **Preview** environment does **not** contain them; only variable **names/targets/types** were read. No sensitive values retrieved.
- [x] Vercel recent runtime error summary reported no clusters for the past 24 hours at inspection. Do not mistake this for proof of zero individual application errors or availability SLA.
- [x] Implemented and merged [PR #26](https://github.com/senanurcetin/nexus-devops-intelligence/pull/26), application-only release diagnostics: `X-Nexus-Rate-Limit-Source` distinguishes `shared-redis` from `local-fallback`, `github-upstream` and `shared-redis-unavailable`. `X-Nexus-Rate-Limit-Mode` marks the currently selected origin admission layer on responses. No tokens, IPs, keys, counter values or paid dependencies are exposed. No Vercel deployment triggered.
- [x] CI-free temporary Vercel Sandbox checks for PR #26: **90/90 Node tests**, TS check, production build, full npm audit (**0 findings** at time of execution), read-only GitHub HTTP smoke. The sandbox was ephemeral.
- [x] **Upstash Free plan confirmed by owner-visible console:** Upstash database screen explicitly displays `Free Tier` and region `EU-CENTRAL-1`; `Upgrade` is the optional paid-plan action. **Do not click Upgrade**. This is evidence of plan selection, not independently verified invoices, quota consumption or auto-upgrade settings; no billing/account secrets were accessed.
- [ ] **Actual Upstash consumption still unknown:** Commands used this month, storage usage, and remaining quota were not displayed on that screen. Inspect only when the dashboard provides safe aggregate figures; this is not a blocker for CI-free pre-release code/preview preparation.
- [ ] **Preview credentials:** Any Redis-capable protected preview requires owner-managed **Preview-scoped** sensitive environment variables (or an approved isolated Free test database). Never copy production secrets into Preview without owner review. No preview deployment has been initiated.
- [ ] **Manual protected release approval:** Current `main` contains the Redis-authoritative and provenance fixes, but current production still runs `74cd0e3`. Do not deploy automatically or use the production alias merely to bypass absent preview readiness. After approval, manually release a precisely identified and revalidated commit, test on the actual deployment and preserve the previous deployment ID for rollback.

**Important:** P0.1 is *partially* complete. P0.2 is blocked by missing Preview Redis config / approved release; issue #7 and human QA issue #5 remain **OPEN**. These checks do not imply that Vercel WAF Log mode blocks requests.


### P1 client-data validation evidence — 13 October 2026

- [x] [PR #27](https://github.com/senanurcetin/nexus-devops-intelligence/pull/27) squash merged as `6eb6d6cd7d0e897e88e7151320b6b32955d00780`: both Actions and PR panels now reject unexpected HTTP 200 JSON (wrong selected repository, inconsistent aggregate metrics, invalid PR classification, malformed fields, duplicate IDs or noncanonical GitHub links) before any data reaches React state. The page instead shows a concise retryable error; no untrusted payload is displayed.
- [x] CI-free temporary Vercel Sandbox: clean npm ci, **96/96 tests**, TypeScript, production build, zero vulnerabilities in npm audit at check time, real GitHub REST smoke.
- [x] Browser: Chromium **375px, 768px and 1440px**, with mocked bad 200 JSON in both panels followed by valid samples on user Retry, recovered on all three viewports; zero JS errors, horizontal overflow or automated axe WCAG 2/2.1 A/AA violations. Tablet and desktop were rerun in independent Chromium processes after the first combined process ended unexpectedly.
- [ ] Human NVDA/VoiceOver and real-device visual signoff still **required** (issue #5). Automated browser tests do not satisfy this acceptance gate.
- [ ] The latest GitHub source has not been deployed or revalidated on the live production alias; Redis Preview variables and P0 #7 acceptance remain separate blockers. Do not infer a production fix from the merge.

### P1 targeted retry and stale-request evidence — 13 October 2026

- [x] [PR #28](https://github.com/senanurcetin/nexus-devops-intelligence/pull/28) squash merged as `9618ede1a0c14fd0ae804229e9f01d661b66f837`. The shared Retry action now refreshes **only the failed Actions or PR source panel**; if both failed, both refresh. Already verified sibling data and last-success timestamp remain intact, avoiding unnecessary GitHub and Redis requests in the Free/Hobby plan.
- [x] **Race behavior observed in a real Chromium browser:** switching `owner/first` to `owner/second` while both source requests were delayed left only second-repository Actions/PR results visible (375 and 1440px). Previous AbortController generation checks remained unchanged.
- [x] Browser partial retry scenarios: PR-only (375, 768), Actions-only (375, 768), both-failed (375, 1440). All recovered with the correct **one or two** new requests. Dedicated Chromium processes were used to avoid unrelated sandbox browser closure.
- [x] CI-free manual checks: **96/96 Node tests**, TS and production build, npm audit zero reported vulnerabilities at test time, live read-only GitHub REST HTTP smoke. Axe WCAG 2/2.1 A/AA at 375, 768, 1440: **0 automated violations, 26 passes per viewport**; no reported page JavaScript exceptions or horizontal overflow.
- [x] [QA evidence](https://github.com/senanurcetin/nexus-devops-intelligence/blob/main/docs/RETRY_RACE_BROWSER_QA_2026-10-13.md) saved with fixtures clearly labeled; no mocks passed off as real GitHub data.
- [ ] Human NVDA/VoiceOver and real-device visual acceptance remains **OPEN** (#5). Redis's actual cross-instance proof, Preview-scoped secrets and reviewed manual release remain **OPEN** (#7). No production deployment occurred.


### P0.2 protected-preview Redis probe preparation — 13 October 2026

- [x] [PR #29](https://github.com/senanurcetin/nexus-devops-intelligence/pull/29) merged as `a0ae2010c5792443540e5e1cd33da9f6fef1949d`, adding **manual-only, zero-secret protected Preview admission verification**. CLI `scripts/verify-protected-redis-preview.mjs` refuses the production alias and non-NEXUS team URLs **before issuing any request**; does not follow redirects or leak any optional Preview bypass token.
- [x] One-GET default preflight and separate **explicitly requested** bounded 21-request / 55-second Actions+PR shared quota test; it rejects cache HIT, SSO redirect, unknown Redis mode, incorrect `429` source or unbounded Retry-After. `crossInstanceVerified:false` remains explicit even after successful first-instance origin `429`.
- [x] CI-free cloud validation: **105/105** Node tests; TypeScript, Next.js production build, 0 reported `npm audit` vulnerabilities and real public GitHub HTTP smoke. Real CLI against production alias with the full test flag returned `blocked`, `requests:0`.
- [x] Test procedure: [PROTECTED_REDIS_PREVIEW_QA_2026-10-13.md](https://github.com/senanurcetin/nexus-devops-intelligence/blob/main/docs/PROTECTED_REDIS_PREVIEW_QA_2026-10-13.md).
- [ ] **External gate:** Preview-scoped **Sensitive** Upstash Redis REST credentials are still absent; do not copy production credentials or relax SSO without user-approved secure provisioning. Account owner showed `EU-CENTRAL-1 / Free Tier`, but actual usage remains unknown.
- [ ] **Release gate:** no manual Preview deployment or real Redis shared-counter test was performed by this PR. A reviewed, exact-SHA and properly protected Preview deployment is required before executing the one-request preflight and separately authorized bounded probe. Multi-instance proof and the production rollout remain unverified; issues #7 and #5 stay open.
