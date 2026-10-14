# NEXUS DevOps Intelligence

An independent, read-only dashboard for inspecting recent GitHub Actions workflow runs
and pull request merge state. **This is not part of Ops-Copilot.**

> **CURRENT SOURCE / RELEASE STATUS — 14 October 2026:** GitHub's current F01–F05
> source has advanced beyond the previously audited [`599ced7` candidate](docs/NEXUS_RELEASE_CANDIDATE_MANIFEST_2026-10-14.md).
> The offline integrated F01–F05 milestone recorded **187/187 Node tests**, TypeScript,
> build and measured bundle budget with no reported audit findings **at that checkpoint**;
> these results are not a fresh verification of every later documentation commit.
> Vercel **Production is live on older `74cd0e3`**. The latest recorded **SSO-protected
> Preview is READY on older `599ced7`** ([immutable deployment URL](https://nexus-devops-intelligence-qwftzbzic-senanurs-projects-102fb36c.vercel.app)).
> **Neither deployment contains the latest F01–F05 features.** Git merging does not deploy
> (`git.deploymentEnabled:false`). Human NVDA/VoiceOver/physical-device acceptance,
> actual owner-authenticated Preview functionality, cross-Vercel-instance shared Redis
> proof and shared Upstash Free usage all remain **unverified**. The Vercel Hobby rate
> limit rule is **Log-only**; it is not an enforcing 429 edge WAF.
>
> **Source of truth for next work:** [current release work plan](docs/NEXUS_CURRENT_RELEASE_WORK_PLAN_2026-10-14.md),
> [current Preview/human acceptance issue #49](https://github.com/senanurcetin/nexus-devops-intelligence/issues/49),
> [shared Redis issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7),
> and [manual release/rollback](docs/NEXUS_MANUAL_RELEASE_RUNBOOK_2026-10-14.md).
> **No CI, paid protection, 21-request live shared Free Redis probe or Production
> deployment is authorized by these documents.**

**Historical engineering milestones below** describe earlier commits and test sessions;
they are not a statement that those older commits are today's Production release.

> **Verified MVP development build (13 October 2026):** [PR #3](https://github.com/senanurcetin/nexus-devops-intelligence/pull/3)
> upgraded Next.js; [PR #6](https://github.com/senanurcetin/nexus-devops-intelligence/pull/6)
> migrated Tailwind to 4.3.3 and fixed secondary-text contrast. Clean cloud `npm ci`,
> **78/78 tests**, full TypeScript and production build passed. Full `npm audit`
> (including development dependencies) reported **zero findings at the time checked**.
> Chromium 375/768/1440 responsive checks and automated axe-core A/AA tests passed.
> **At that earlier test milestone**, no public deployment existed. A later Production
> deployment was created on older SHA `74cd0e3`; this milestone did **not** release today's app.

**Release security:** [PR #9](https://github.com/senanurcetin/nexus-devops-intelligence/pull/9)
adds verified anti-framing, MIME-sniffing, referrer and permissions headers,
plus a limited CSP. The production HTTP smoke checks their presence on the
site and public APIs. These protections do not replace a Vercel WAF rate limit;
WAF counters are per region, and the Hobby pricing acknowledgment remains
outstanding.

**Cross-browser QA:** [Firefox 157 manual smoke and axe-core check](docs/firefox-browser-qa-2026-10-13.md)
passed at 375, 768 and 1440 pixels with controlled API error responses.
Chromium, Firefox and [Playwright WebKit](docs/webkit-browser-qa-2026-10-13.md)
are covered with manual cloud viewport and automated axe checks. Human
screen-reader, real-device visual review and public preview checks remain outstanding.

**Metric accuracy:** [PR #10](https://github.com/senanurcetin/nexus-devops-intelligence/pull/10)
corrected GitHub Actions outcome breakdowns: cancelled/skipped/neutral runs
are no longer counted as pending, and completed timeout/startup-failure runs
are correctly included in confirmed failures. The figures remain a sample
rather than billed CI minutes.

**GitHub quota handling:** [PR #11](https://github.com/senanurcetin/nexus-devops-intelligence/pull/11)
correctly interprets primary and secondary GitHub rate-limit HTTP 403 responses
as HTTP 429 without automatically retrying and distinguishes ordinary 403
restrictions. The 48-test suite, typecheck, production build, full npm audit
and manual HTTP smoke passed in a temporary cloud sandbox.

**Rate-limit wait hints:** [PR #12](https://github.com/senanurcetin/nexus-devops-intelligence/pull/12)
propagates validated numeric 1–3600s `Retry-After` headers through both
read-only APIs. The dashboard displays safe wait guidance for GitHub or edge
WAF 429 responses, without background or automatic retries.
See [API rate-limit behavior](docs/RATE_LIMIT_BEHAVIOR.md).
The user-configured WAF rule has **Log-only** action, not active 429 enforcement; rate-limit hints are not a substitute for protection.

**Input validation under load:** [PR #13](https://github.com/senanurcetin/nexus-devops-intelligence/pull/13)
validates both read-only API parameters before the process-local in-flight gate.
Invalid or oversized repositories always receive 400/no-store even when all
12 capacity slots are occupied; a valid overloaded request receives 503.
This is not cross-instance WAF enforcement.

**Independent panel refresh:** [PR #14](https://github.com/senanurcetin/nexus-devops-intelligence/pull/14)
adds separately labeled Actions and PR refresh controls. One failed source can
be reloaded without erasing or refetching the other; per-panel aria-busy and
screen-reader status remain independent, and switching repositories cancels
stale results. Chromium at 375/1440px and axe-core WCAG A/AA automated
checks passed. [Manual QA evidence](docs/panel-refresh-browser-qa-2026-10-13.md).

**Human accessibility checks:** The [manual screen-reader acceptance list](docs/MANUAL_ACCESSIBILITY_ACCEPTANCE.md)
is prepared, but has **not** been performed by an NVDA/VoiceOver tester.
Real-data browser screenshots are not committed because the file transfer
was blocked; automated browser checks do not constitute human sign-off.

**PR detail quota correctness:** [PR #15](https://github.com/senanurcetin/nexus-devops-intelligence/pull/15)
prevents a quota-limited PR detail from being silently reported as a
successful PR analysis. A primary/secondary GitHub rate limit in any detail
now returns HTTP 429/no-store and the longest validated Retry-After hint.
Ordinary detail failures remain unknown. No automatic retries.
See [rate-limit behavior](docs/RATE_LIMIT_BEHAVIOR.md).

**PR-detail quota conservation:** [PR #16](https://github.com/senanurcetin/nexus-devops-intelligence/pull/16)
caps concurrent GitHub PR-detail calls at **two**. Once a worker observes
a quota response, unscheduled detail requests are not started. Already
running requests finish so their bounded Retry-After can be preserved.
This can increase latency for slow responses and is **not** a Vercel
platform-wide traffic limiter. See [rate-limit behavior](docs/RATE_LIMIT_BEHAVIOR.md).

**Slow PR analysis feedback:** [PR #17](https://github.com/senanurcetin/nexus-devops-intelligence/pull/17)
now announces a non-blocking slow-load state if the current PR request takes
longer than 2.5 seconds. The hint clears when data arrives or the selected
repository changes; it does not trigger new requests. The two-worker PR
detail limit still applies. Controlled **80/160ms** simulated per-detail
latency resulted in **243/482ms** total for five details; these are **not**
real GitHub performance measurements. See
[manual latency and browser QA](docs/pr-slow-load-browser-qa-2026-10-13.md).

**Hobby-safe local protection:** [PR #19](https://github.com/senanurcetin/nexus-devops-intelligence/pull/19)
adds a Vercel-only, per-instance 20 requests/minute budget shared by both
public API endpoints. It rejects excess requests with HTTP 429 before upstream
GitHub calls and does not need a paid datastore. **It is not a distributed
rate limiter or enforced WAF.** The user-created Vercel firewall rule was
reported as Log-only and remains an open release gate.
[Security behavior and limitations](docs/HOBBY_LOCAL_API_PROTECTION.md).

**Canonical source-IP protection:** [PR #20](https://github.com/senanurcetin/nexus-devops-intelligence/pull/20)
normalizes equivalent IPv6 notations and IPv4-mapped IPv6 to one local
request-budget identity, preventing one IP from receiving multiple local
20/minute budgets under different text representations. A new memory-bound
test validates 1,024 buckets and expiration. This is still **per function
instance**, not shared edge rate limiting. See [Hobby protections](docs/HOBBY_LOCAL_API_PROTECTION.md).

**PR inspection count accuracy:** When GitHub cannot establish a pull request's
merge state, the UI now counts that `unknown` PR among items **needing
inspection**. This matches the existing investigation recommendation; it
does **not** present unknown statuses as confirmed merge conflicts. Draft
and clean PRs are excluded. Regression tests and controlled responsive
browser checks are documented in
[PR inspection QA](docs/pr-inspection-count-browser-qa-2026-10-13.md).

## Current source scope — public read-only MVP

- Public GitHub repositories only; no GitHub token, GitHub App installation, private repository access or write permission.
- An **up to 10-run** GitHub Actions sample and **up to 5-PR** open pull request sample with independent source, staleness, loading and error receipts. These are neither repository-wide performance rates nor billed CI minutes.
- **F01:** manually downloaded, filtered **CSV/JSON** exports of available, source-verified sample rows; unknown/stale results are not promoted into a complete report.
- **F02:** evidence-first investigation queue with direct GitHub provenance and bounded, explainable next steps; **no AI root cause assertion**.
- **F03:** validated shareable public `repo=owner/name` selections, clipboard/history navigation and repository-switch isolation.
- **F04:** user-triggered verification details for one selected PR and one confirmed failed workflow run, including bounded check/review or job/step evidence; **no automatic background detail fan-out, raw logs or workflow execution**.
- **F05:** explicitly requested counts for the **seven completed UTC workflow creation days**, displayed only when returned GitHub coverage is complete; not a historical reliability SLA.
- Redis-first distributed origin request admission when configured, with fail-closed unavailable behavior; per-process fallback when Redis is absent. This is **not** edge WAF and requires real multi-instance/Free-capacity acceptance.

All F01–F05 functionality is in **GitHub source**, not yet accepted on an exact-SHA live Preview or released to current Production.

## Run locally

Requires Node.js 22.16+ and internet access for the initial dependency installation.

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Validate

```bash
npm test
npm run typecheck
npm run build
```

**CI-free workflow:** Tests, typecheck and production build are run manually in a
short-lived cloud sandbox, without GitHub Actions or CircleCI. The current
`npm test` command uses the locked `tsx` development dependency and requires
`npm ci` first. There is no requirement to install anything on the user's PC.

## CI-free cross-engine browser verification (T-03)

The same [F01–F05 real-browser fixture runner](scripts/manual-browser-f01-f05.mjs)
accepts `NEXUS_BROWSER_ENGINE=chromium` (default), `firefox`, or `webkit`;
there is **no fallback to another engine** if a requested one cannot launch.
Install `playwright-core@1.64.0` and `axe-core@4.11.0` only into the
manual QA checkout, then `npx playwright-core install chromium firefox webkit`,
build/start the local app, and run `npm run test:browser:manual` for each
selected engine. On Windows PowerShell set
`$env:NEXUS_BROWSER_ENGINE="firefox"` before running the npm script.

**Exact-source T-03 engineering result:** Chromium **11/11**, Firefox **11/11
twice**, Node **205/205**, local HTTP **16/16**, TypeScript/build/bundle and
audit 0 all passed in an isolated Linux sandbox. **WebKit has not passed or
run any scenario:** Amazon Linux 2023 lacks the downloaded WebKit build's
ICU 74, GTK/GStreamer and media libraries. See the [dated cross-engine
evidence and supported-host retry instructions](docs/T03_CROSS_ENGINE_WEBKIT_QA_2026-10-14.md).
Even passing Playwright WebKit on another host is **not real iOS/macOS Safari
or human VoiceOver/NVDA acceptance**. The no-network fixture and loopback-only
URL safeguards are mandatory for all engines.

## Five-route source integrity and fail-closed admission (S-03)

All five `/api/public-*` endpoints reject **duplicate `repository` fields,
unexpected query parameters and invalid source values** with `400 / no-store`
*before* calling the shared Redis limiter or GitHub API. An intentionally
simulated Redis over-limit result returns an attributed `429` and bounded
`Retry-After`; Redis failures or incomplete credentials return `503`
without an upstream fallback. `npm run smoke:http:offline` now exercises
**16 negative/origin-local HTTP checks**; five additional Node tests validate
all five routes' fake-Redis response contracts and shared hashed budget key.
The [dated 204-test security verification](docs/S03_FIVE_PUBLIC_API_ADMISSION_QA_2026-10-14.md)
is **not** evidence of cross-Vercel-instance Upstash enforcement or actual
account quota. No new deployment has been triggered.

## Free-tier capacity preflight (offline, account data required)

`npm run capacity:offline` is a zero-network, credential-free **G-02
capacity screen** for owner-entered **shared Upstash Free database usage** and
**whole Vercel Hobby team usage**. With no data it returns
`INCOMPLETE` / exit code 2. It refuses stale snapshots and proposes a 20%
headroom reserve, assuming four Redis commands per additional origin GET for
planning only. A result of `READY_FOR_OWNER_REVIEW` is **not release approval**;
read the [dated evidence, source and usage requirements](docs/G02_CAPACITY_PREFLIGHT_2026-10-14.md).
Do not input Upstash REST tokens or URLs, deploy, or run live Redis tests
merely to obtain a usage estimate. The owner must verify aggregate vendor
dashboards first; actual current usage was not available from this connector.

## Current repeatable browser regression (F01–F05)

The [committed real-Chromium fixture regression runner](scripts/manual-browser-f01-f05.mjs)
can be invoked manually with `npm run test:browser:manual` after installing
optional `playwright-core@1.64.0` and `axe-core@4.11.0` locally in a short-lived
sandbox. It refuses non-loopback origins, intercepts **all five** NEXUS API routes,
blocks off-origin requests and service workers, and makes **no valid live GitHub
or Upstash API calls**. The persisted runner now checks **11 journeys**,
including native CSV/JSON downloads, explicit PR/run drilldowns, complete versus
incomplete UTC trends, source races, invalid share links, **320/375/768/1280/1440px**
layouts, and simulated **200%/400% text-only zoom at 320px**. Optional
`NEXUS_BROWSER_CAPTURE_DIR=./qa-captures` writes source-SHA-labeled local
PNG screens including the expanded seven-day matrix. **Two consecutive complete
11-journey Chromium runs passed** at the [T-02 QA checkpoint](docs/T02_EDITORIAL_RESPONSIVE_QA_2026-10-14.md);
the earlier [T-01 source-only results](docs/T01_PERSISTENT_BROWSER_REGRESSION_QA_2026-10-14.md)
are retained for history. The NEXUS chart/UTC table hierarchy has also been
refined; fixture screenshots are not human editorial or actual
Safari/mobile/NVDA/VoiceOver acceptance.

## CI-free browser verification

The [manual Tailwind 4 browser/a11y report](docs/tailwind4-browser-audit-2026-10-13.md)
covers Chromium screen widths, invalid repository validation, rapid repo switching,
and an axe-core WCAG 2/2.1 A/AA scan. These manual checks are separate from the
**33 automated Node.js tests at that historical stage** and require no GitHub Actions or CircleCI.

**Current release gate:** The latest merged application implements **Redis-first shared origin admission** for both APIs when Upstash is configured; an older per-process fallback remains for unconfigured environments. This is **not** Vercel edge WAF enforcement. Existing Production is on an older SHA, and its behavior does not prove the latest implementation. [Issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) tracks the remaining live cross-instance proof; final human accessibility and manually authorized protected Preview verification are also outstanding. See the [current status register](docs/NEXUS_ACCEPTANCE_STATUS_2026-10-14.md).

### Independent panels and edge rate limiting

[PR #8](https://github.com/senanurcetin/nexus-devops-intelligence/pull/8)
adds independent Actions/PR panel resolution, screen-reader loading announcements
and safe handling of non-JSON WAF 429 responses. Manual Chromium regression
checks at 375/768/1440px and six new offline unit tests passed. See
[the browser QA record](docs/independent-panel-qa-2026-10-13.md).

**Important:** Client-side 429 handling is not a firewall. Platform-wide WAF
rate limiting remains a prerequisite before broad public release; see
[issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7).

## HTTP API

- `GET /api/public-actions?repository=owner/repo`
- `GET /api/public-prs?repository=owner/repo`

Both API routes call fixed `api.github.com` endpoints only. Results are anonymous,
cached for up to two minutes and subject to GitHub's public API rate limits.
The PR endpoint sends at most six upstream GET requests per cache miss;
draft PRs skip their detail request. Upstream 404, rate limits and timeouts are
handled explicitly, and failed PR-detail responses produce an unknown state.

## Independence from Ops-Copilot

The initial prototype was drafted in an Ops-Copilot feature branch but never merged
into that repository's `main`. The product is extracted into this separate repository
to keep the industrial AI assistant and developer tooling independent.

## CI-free testing

The GitHub API adapter can be tested with mocked REST responses using Node.js 22+
without invoking any hosted CI job:

```bash
npm test
```

All mocks remain local; the tests do not call GitHub or CircleCI. A clean
`npm ci --no-audit --no-fund`, full TypeScript check and production build were
verified in a temporary Vercel Sandbox without CI. Start a production server
with `npm run start`, then run `npm run smoke:http` to check live HTTP routes.

## Release limitations

The repository has a **working public Production URL serving old source**, not a release of the latest app. The old SSO-protected Preview also predates F01–F05. The **current F01–F05 source is implemented and previously tested offline, but not deployment-accepted**. Do not use Production screenshots to review the newer UI, assume the 187-test milestone passed on a newly selected SHA, or present automated accessibility fixtures as real-device acceptance.

Follow the [current release work plan](docs/NEXUS_CURRENT_RELEASE_WORK_PLAN_2026-10-14.md) for immutable source pinning, exact-build rerun, Free Redis usage checks, separately authorized protected Preview, real network/visual testing, human screen-reader/device review, Vercel cross-instance Redis proof, and separately approved Production/rollback.

## Roadmap

1. Re-run test/typecheck/build/bundle/audit/smoke on the next **immutable** F01–F05 candidate without hosted CI.
2. Preserve the integrated browser fixture runner as a replayable, opt-in **CI-free** test instead of relying only on ephemeral past screenshots.
3. After Free capacity/owner approval, manually deploy the exact source to SSO-protected Preview and verify live F01–F05, mobile/desktop, keyboard and error-state behavior.
4. Finish human Safari/mobile/NVDA/VoiceOver review and independently verify origin Redis across Vercel instances; then request explicit Production approval and rollback readiness.
5. Only after an accepted public read-only MVP, evaluate least-privilege GitHub App/private repositories, read-only CircleCI connector, explainable analysis and deeper trends.

## Support and security

General contact: senanur.cetin.work@gmail.com.
Do not disclose GitHub tokens or private CI logs in public issues.

## Archived cloud verification (13 October 2026)

An **early independent-repository snapshot** at `e51b38057dbc3be35fed4020e7b42434071c7783` was verified manually in a disposable Node 24 Vercel Sandbox, with **24** tests, TypeScript/build and a bounded public GitHub HTTP smoke. The dependency lockfile was committed at that milestone. These observations did **not** exercise today's F01–F05 source, newer Redis gate, live Preview, human accessibility or current Production. Later milestone results are recorded in [the integrated QA report](docs/F01_F05_INTEGRATED_RELEASE_QA_2026-10-14.md) and [release register](docs/NEXUS_CURRENT_RELEASE_WORK_PLAN_2026-10-14.md). No hosted GitHub Actions or CircleCI jobs were used.
