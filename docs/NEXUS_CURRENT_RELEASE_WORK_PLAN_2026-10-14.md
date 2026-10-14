# NEXUS DevOps Intelligence — current work plan and release gates

**As of:** 14 October 2026 (Europe/Istanbul)  
**Scope:** standalone `senanurcetin/nexus-devops-intelligence`. This is a current execution register, NOT release authorization.  
**Tracking:** [#49](https://github.com/senanurcetin/nexus-devops-intelligence/issues/49) (current candidate Preview/human acceptance), [#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) (real Vercel Redis/Free usage). Previous issue #5 is owner-closed; its unchecked human tests are not certified.

## Verified state, kept separate by evidence tier

| Area | Verified observation | Not established |
| --- | --- | --- |
| GitHub source | `main` SHA `aadfa0ff6516bc1a15e0e2e8965a26adc8032ff4` at this inspection; F01–F05 and integrated source tests present | Moving `main` is not an immutable release candidate |
| Offline tests | Last recorded exact isolated QA branch: **187/187 Node tests**, TS/build, measured JS **431,862 bytes raw / 124,789 gzip**, audit **0 at inspection**; Chromium fixture journeys; real **local** Redis 6.2.20 across two Node processes (20 allowed / 21st 429) | Those historical results are not a fresh test of `aadfa0f`, a live Preview, or the Upstash Free instance |
| Vercel Preview | `dpl_Beyxk5vGuDcvx5XDD4gVdsbUX9tg` READY on **older** `599ced76605c25161b182b2d5bfbadbd091bfb53`; project SSO setting enabled for applicable generated URLs | F01–F05 are **not** deployed in that Preview; exact signed-in visual/API acceptance absent |
| Production | `dpl_9fXGATNHhyhNVrN1i47k3BU4u5K5` READY, **older** `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf` | Current F01–F05 Production launch **not** authorized or verified |
| Redis / WAF | Vercel Redis variable names have historically been configured for Preview and Production, and one older protected Preview Redis-mode preflight was recorded. Offline real Redis gate proven. | Cross-**Vercel-instance** enforcement and actual Upstash shared Free command/storage headroom remain **unknown**. Hobby WAF rule remains **Log**, not active 429 enforcement |
| Accessibility | Controlled Chromium/Firefox plus automated axe A/AA scenarios recorded | Human NVDA/VoiceOver, macOS/iOS Safari, physical-device and editorial approval missing |

The historic [599ced7 release manifest](NEXUS_RELEASE_CANDIDATE_MANIFEST_2026-10-14.md) is still valid **as a dated snapshot**, but it does not describe the current application source. Do not quietly re-label that Preview as F01–F05.

## Remaining execution plan (ordered, with acceptance criteria)

| Priority / gate | Responsible lane | Specific work | Acceptance evidence / definition of done | Status |
| --- | --- | --- | --- | --- |
| **P0 / G-01 — immutable candidate** | Engineering | Freeze reviewed F01–F05 `main` SHA; inspect diff since last 187-test evidence. Independently execute `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm run inspect:budget`, `npm audit`, local `npm run smoke:http` using a *disposable* cloud checkout. | Exact full SHA, environment/version, command exit codes, test count, bundle bytes, audit timestamp, bounded HTTP results; zero CI minutes. The older 187/187 count is only a baseline. | **Open: re-run exact candidate** |
| **P0 / G-02 — Free capacity** | Owner/account access | Read **aggregate** Upstash Free command/storage usage for the shared Preview+Production DB and verify remaining headroom. Review Vercel Hobby usage/charges and current WAF Log-only behavior. | Numbers and inspection time recorded; no credential plaintext, no paid plan activation. Stop high-volume probes if headroom is insufficient. | **Open; unknown live usage** |
| **P0 / G-03 — protected Preview** | Owner-approved deployment | Only with explicit Preview-only approval, manually deploy frozen SHA to existing dedicated Vercel project; Git auto-deploy stays disabled; preserve SSO and current Production aliases. | Vercel unique URL/deployment ID, **exact SHA**, READY, project/team/target and SSO metadata, snapshot/rollback reference. Old `599ced7` Preview **does not count**. | **Open for F01–F05** |
| **P0 / G-04 — actual Preview behavior** | Engineering + authenticated reviewer | On the **exact G-03 unique SSO URL**, test 375/1280–1440px, summary cards, Actions and PR evidence, investigation queue; validate F01 CSV/JSON source/partial export, F02 provenance, F03 share/history, F04 user-click-only PR+failed-run details, F05 user-click-only seven *complete* UTC days. Exercise malformed repo 400, partial 503, 429, stale repo switch, keyboard focus, no-store errors, source receipts and no hidden network fan-out. | Actual bounded Preview request ledger, screenshot provenance, checked source-SHA label, distinct fixture-vs-real origin observations and pass/fail log. Never fabricate sample coverage. | **Open; localhost fixtures are not Preview QA** |
| **P0 / G-05 — human sign-off** | Human reviewer | Real iOS/macOS Safari or equivalent WebKit device, 375px mobile + wide desktop screenshot review; NVDA/VoiceOver checklist **SR-01–SR-12**, keyboard-only journey, zoom, focus, announcements, chart/table and export legibility. | Explicit tester/date/browser/viewport/result and evidence. Automated axe 0 findings is **not** certification. Track in #49, do not silently reopen owner-closed #5. | **Open** |
| **P0 / G-06 — real Redis acceptance** | Owner + engineering | Verify first that G-02 approves any tiny bounded Preview-origin checks. Confirm **actual independent Vercel instance** Redis shared admission and shared route scope without relying only on process-local or local Redis evidence. Determine supported low-quota way to prove this or record formal residual risk. | Instance provenance plus Redis-origin 429/no-store/Retry-After, shared /Actions+/PR bucket, observed Free quota delta, no GitHub-upstream/local 429 misattribution. Single 21-request client test **cannot** prove multi-instance. Existing #7 stays OPEN until this evidence or documented owner risk decision. | **Open** |
| **P0 / G-07 — Production release** | Owner-only approval + engineering | After G-01–G-06 evidence and separate explicit Production authorization, stage verified Production build, check exact source/rollback, then manual release and small post-release smoke. | Public alias SHA matches approved source, deployment record, bounded 200/400/error checks and documented rollback. No automatic release or Preview promotion masquerading as source-identical Production. | **Not authorized** |
| **P1 / T-01 — persistent browser regression** | Engineering | Preserve a replayable, no-CI fixture harness for integrated F01–F05 user journeys; previous Playwright runner was ephemeral. Use optional/manual local invocation without adding hosted CI. | Committed test source, reproducible run command, no real Upstash/API calls by default, measured 375/1280 request budget and stale-data conditions. | **Open engineering task** |
| **P1 / T-02 — visual/editorial refinement** | Engineering + owner | Review the **new F01–F05 UI**, not old Production screenshots; refine charts, density, source hierarchy, long labels, 320px + extreme zoom and mobile disclosure states while retaining NEXUS branding. | Version-tagged screenshots and explicit reviewer decisions; actual Safari/mobile evidence kept separate from Chromium/Firefox tests. | **Open** |
| **P2 / future scope** | Product discovery | Private GitHub App with least-privilege permissions, read-only CircleCI data connector, evidence-linked AI analysis, deeper historical trends, commercialization. | Separate need, security/cost analysis and explicit approval; not prerequisite for releasing the **public read-only** MVP. | **Deferred** |

## Product feature contract (already implemented in GitHub, release still open)

- **F-01:** user-initiated filtered CSV/JSON export; do not include unverified/stale panel samples or unsafe spreadsheet formula literals.
- **F-02:** evidence-first investigation context and direct GitHub links; no unsupported root-cause diagnoses.
- **F-03:** validated canonical public `repo=owner/name` share link and source-safe browser Back/Forward; no secret inputs.
- **F-04:** on-demand selected PR check/review evidence and **confirmed failed** workflow run/job evidence; no automatic detail fan-out or raw private logs.
- **F-05:** optional seven completed UTC *creation* days with explicit completeness gate; partial GitHub results never become a historical SLA/chart.
- **Read-only security contract:** public GitHub GETs only; fail-closed Redis when configured but unavailable; optional local guard is not distributed WAF; do not trigger or bill GitHub Actions/CircleCI.

## Immediate next execution (no release implied)

1. Preserve this register and issue #49 as the single **current** release acceptance route. Treat dated 13 October planning documents as history when their statements conflict with this 14 October source inventory.
2. Work **G-01** on a pinned Git SHA without modifying the live environment, including a new exact-source Node/TS/build/budget/audit proof. Keep tested vs untested claims explicit.
3. Implement **T-01** repeatable fixture browser QA before another large visual redesign, so every F01–F05 state/URL can be rechecked reliably and cheaply.
4. Require owner-controlled **G-02** and explicit **G-03** Preview authorization before any new cloud deployment or Upstash check. Do **not** run a 21-request live probe on the shared Free instance by default.
5. When a new SSO Preview actually exists, perform **G-04** and human **G-05**. Resolve or accept documented residual **G-06** risk, then ask for independent **G-07** Production approval.

## Operating constraints

**No GitHub Actions, CircleCI or other hosted pipelines; no Git-based auto-deploy; no paid firewall activation; no SSO protection bypass; no unapproved stress test; no unauthorized Production deployment.** Never copy Upstash tokens, GitHub tokens, real user IPs, private logs or protected screen sessions into issues, PRs, browser assets or telemetry. CI-free means manually initiated verification with exact command evidence, **not** skipped verification. Keep Ops-Copilot separate.

## Evidence index

- [14 Oct acceptance ledger](NEXUS_ACCEPTANCE_STATUS_2026-10-14.md) — verified vs unverified
- [F01–F05 integrated source QA](F01_F05_INTEGRATED_RELEASE_QA_2026-10-14.md) — 187 offline tests and local Redis experiment
- [Current candidate/Rollback manifest](NEXUS_RELEASE_CANDIDATE_MANIFEST_2026-10-14.md) — **historical 599ced7 SHA**
- [Manual release/rollback](NEXUS_MANUAL_RELEASE_RUNBOOK_2026-10-14.md)
- [Real physical-device/screen reader acceptance](MANUAL_ACCESSIBILITY_ACCEPTANCE.md)
- [Protected Redis guidance](PROTECTED_REDIS_PREVIEW_QA_2026-10-13.md) — read alongside superseding ledger
