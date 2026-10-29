# NEXUS DevOps Intelligence — Advanced Architecture (27 Oct 2026)

## Verified baseline
- Community is MIT-licensed, public-repository only, anonymous read-only GitHub REST, bounded 10-run/5-PR inspection.
- F01–F05, input/security safeguards, shared Redis design and source-local QA exist; source and deployed protected Preview / Production SHA differ.
- Localhost Docker candidate remains draft PR #80: Windows acceptance exists, independent native Ubuntu OS/CVE acceptance remains OPEN.
- No hosted GitHub Actions / CircleCI, unauthorized deployments, paid WAF, Redis stress probes, billing changes or 21-request live quota tests.
- Jarvis integration is deferred: DevOps remains an independent service.
- This architecture plan is not authorization for remote mutations, billing, production or external communications.

## Staged architecture and product gates

| Phase | Deliverable | Nonnegotiable acceptance | Status |
| --- | --- | --- | --- |
| S0 Evidence-backed Community | Bounded Actions/PR observations, filtered exports and source-linked investigation brief | Source-exact test/typecheck/build; truthful coverage receipts | Existing source + proposed enhancement |
| S1 Reproducible self-hosted | Non-root, loopback-only Docker, version/digest and rollback | #80/#81 native Ubuntu Engine, vulnerability review, owner approval | OPEN |
| S2 Live release acceptance | Exact-SHA SSO Preview, Safari/NVDA/VoiceOver, independent Redis enforcement | #49 and #7, approved and budgeted live checks | OPEN |
| S3 Release evidence | Offline release manifest (SHA, test results, OS, dependency and security receipts) | Fail/HOLD on missing evidence; source vs live separation | Planned |
| S4 Rights-cleared Pro | Private repo GitHub App, multi-repo teams, durable evidence history | New proprietary value, permission isolation, encryption, retention rules | Not built |
| S5 Guarded execution | Opt-in CI/deployment jobs with dry-run, scoped approval, idempotency, rollback | Owner approval per action, audit log, kill switch and no default writes | Not built |
| S6 AI diagnosis | Cited hypotheses, confidence, security redaction, evaluation | Offline labeled cases, hallucination and prompt-injection tests | Not built |
| S7 Commercial Cloud | Multi-tenant quotas, security monitoring and budget enforcement | Product/legal/billing approval; no commercial use of unsuitable Hobby hosting | Not authorized |

## Domain architecture

1. GitHub read ingestion: host allowlist, bounded queries, expiry/coverage receipts, quota and error classification. Zero token exposure.
2. Evidence integrity: source SHA, observed UTC time, repository ID, sample coverage, signature support only after sound key lifecycle exists.
3. Deterministic review: distinguish confirmed failure, merge conflict, unknown and stale evidence. No invented CI rate or merge approval.
4. Release policy engine: versioned PASS / FAIL / HOLD / NOT_RUN manifest; explicit human sign-off; documented rollback.
5. Observability: privacy-safe structured events and SLI/SLO only on reliable coverage; no covert analytics.
6. Provider adapters: Pro GitHub App and future providers behind separate read versus write scopes and tenant isolation.
7. Sales delivery: customer-hosted verified service with clear limitations. Public MIT Community rights remain intact.

## Engineering backlog

**P0 — Existing blockers.** Keep Docker #80 in draft while Ubuntu Engine and image CVE tests are missing; reconcile main/Preview/Production SHA, require exact-source checks. G04/G05/G06 are still independent live acceptance gates.

**P1 — Evidence Brief.** Client-only Markdown handoff from the existing verified export snapshot. Include canonical public GitHub URLs, UTC receipt times, sample limits, applied filters, unsupported/missing sources and human release checklist. No new origin GET and no AI-generated diagnosis.

**P2 — Release manifest.** Opt-in offline CLI with immutable source revision, lockfile evidence, test/typecheck/build receipts, dependency/SBOM scan, Windows/Ubuntu/Docker/runtime evidence, reviewer and rollback SHA. Incomplete proof cannot return PASS.

**P3 — Investigation intelligence.** Per-repository triage, deterministic recurrence and change impact only with sufficient data coverage; always mark sampling, missing checks and uncertainty.

**P3 slice 1 (30 Oct 2026, source `src/lib/nexus-workflow-recurrence.ts`):** deterministic repeated-failure signals per workflow name, computed only from the exported sample rows (at most 10 runs) and shown in the Evidence Brief only when a workflow has 2 or more confirmed failures. Cancelled, skipped, neutral and unfinished runs are ignored and never extend or break a streak. Wording makes no flake-rate, root-cause or approval claim. The same section is also part of the Investigation Handoff and therefore of `handoff_markdown` in the Jarvis digest (no schema change, no new top-level field). Change impact, per-repository triage across runs and a dedicated UI panel are NOT built. Verified: 14 new tests, existing Evidence Brief, Handoff and Jarvis tests unchanged and passing, typecheck PASS; full Windows run 330/334 with the 4 known symlink EPERM failures only (not re-run on Linux for this change).

**P4 — Private Pro and guarded workflow.** Only after rights clearing and threat model, add read-only private GitHub App, encrypted credentials, durable history and human permission gates. Write-capable actions remain off by default.

**P5 — Commercial reliability.** Supported self-hosted installation, release playbook, SLIs and quotas before selling. Hosted enterprise and Cloud launch need separate authorization.

## Definition of done

- Isolated reviewable pull request; exact Git commit hash and source-linked QA.
- Fresh npm ci --ignore-scripts, unit/integration, TypeScript, build, security audit. Unexecuted = NOT RUN.
- Hostile input tests: bad URLs, cross-repository payloads, stale receipts, incomplete coverage, 400/429/503/504 errors, malicious Markdown/CSV text.
- For UI changes: keyboard, browser-engine and contrast checks; human assistive-tech and real Safari reviews are separate gates.
- No secrets in frontend, fixtures, sample report, logs or model prompts.
- Execution roadmap defaults to READ_ONLY; future writes need narrow policy, explicit approval, idempotency and rollback evidence.
- Budget stays at 0 TRY unless the owner explicitly authorizes a purchase. No hidden hosted CI, unauthorized probes, deployments or billing edits.
