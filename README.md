# NEXUS DevOps Intelligence

> **15 Oct 2026 — COMMERCIAL PREPARATION / NO REQUIRED PILOT USERS:** NEXUS will be prepared for direct commercial sales without a mandatory free-beta recruitment phase. The first proposed paid SKU is a verified, customer-hosted installation + bounded CI/PR review deliverable; NEXUS Pro software licensing requires **genuinely new rights-cleared premium functionality** in a separately approved private codebase. The existing public MIT Community license remains intact. Internal source-linked usage and exact-SHA security/OS QA remain required, while outside pilot users are optional (zero acceptable). **No paid product, checkout, Pro license or Cloud SaaS is live or ready to sell yet.** See the [commercial sales plan](docs/NEXUS_COMMERCIAL_NO_PILOT_GO_TO_MARKET_2026-10-15.md) and [zero-spend roadmap](docs/NEXUS_ZERO_BUDGET_COMMUNITY_PRODUCT_ROADMAP_2026-10-15.md). Docker #80/#81 and hosted release gates remain open; Vercel Hobby must not host a commercial SaaS.

> **Unreleased local Community candidate (draft PR #80):** The localhost-only Docker Compose installation is proposed in source, not published or accepted on Windows/Ubuntu. See [candidate installation](docs/COMMUNITY_SELF_HOSTED.md) and [version/release gates](docs/COMMUNITY_VERSIONING_AND_INSTALLATION.md). No release tag, Docker runtime acceptance, Vercel Preview or Production deployment is authorized by this draft.

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
> **Prioritized development and gap-closure plan:** [NEXUS master remediation plan](docs/NEXUS_MASTER_REMEDIATION_PLAN_2026-10-14.md) — P0 blockers, P1 visual/data quality, exact-SHA acceptance, human signoff and non-spend restrictions.
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

## F03 shared-link query privacy (15 October)

An incoming public repository link is now canonicalized **in place**: validated
`repo=owner/name` is retained, while unrelated query parameters and hash
fragments are stripped using client-side `history.replaceState`, without
reloads or additional API GETs. Duplicate/invalid repository selections still
show an invalid input warning and do not trigger a GitHub/Redis request.
Exact source `4c41eb7c2ab601916fe7707fce510012ed0f3a5a`:
**232/232 Node, 16/16 local HTTP, 14/14 Chromium, 14/14 Firefox**, TS/build,
page JS 436,153 raw/125,943 gzip under caps, npm audit 0. Source-only;
not retroactive browser/server log erasure or authenticated live Preview proof.
[Exact-source F03 report](docs/F03_CANONICAL_LOADED_SHARE_URL_QA_2026-10-15.md).

## G06 five-route fail-closed regression (15 October)

Five real Next GET handlers—Actions, PRs, PR verification, workflow evidence
and seven-day trend—now have offline route-level tests for invalid input before
Redis, shared-Redis origin 429/no-store/Retry-After with identical opaque bucket,
and Redis-unavailable fail-closed 503 with **zero GitHub fanout**. Exact-source
QA: **230/230 Node, 16/16 compiled local HTTP, 12/12 Chromium, 12/12 Firefox**, 
TypeScript/build/budget and audit 0. These tests use synthetic in-process
Redis EVAL responses, never Upstash or Production; **G06 real multi-instance
acceptance remains OPEN**. See [G06 exact-SHA five-route test report](docs/G06_FIVE_PUBLIC_ROUTES_FAILCLOSED_QA_2026-10-15.md).

## G06 Redis test permission and honest acceptance verdict

The manual `verify-protected-redis-preview.mjs` test **does not
make any network request by default**. It requires an exact
`--confirm-1-request` flag for one source preflight; the 21-request
variant additionally needs both `--confirm-21-request-test` and
`--approve-free-tier-21-origin-reads` **plus a separately authorized
owner-approved live test budget**. It is **not** a scheduled job.

Before this repair, a Redis-attributed 429 at request 21 returned
`state:passed` while simultaneously returning
`crossInstanceVerified:false`. That false implication is corrected:
the 21st same-client Redis 429 returns **`partial`**, with explicit
G06/Production non-authorization. Strict simulated results pass
**224/224 Node** and **11/11 each Chromium/Firefox** on tested SHA
`cc4e97de83a807cdb2a016509de7bff215bbdcce`.
[Full G06 fail-closed source-level evidence](docs/G06_FAIL_CLOSED_PREVIEW_REDIS_PROBE_2026-10-14.md).
**Real two-independent-Vercel-instance Redis admission proof remains
OPEN**, and no new Preview/Production was deployed.

## WebKit engine regression and Windows offline smoke fix (R3)

**R3 automated WebKit acceptance now runs and passes on a real engine:**
Windows + Playwright `1.64.0`, headless **WebKit 27.2**
(revision 2370), **11/11** full source-local browser scenarios,
**221/221 Windows Node**, **16/16 loopback HTTP**, TS/build/budget.
No external browser network, Redis calls or protected deployment.
One Windows-only security-test pathname bug was corrected with
`fileURLToPath`; initial **220/221** became **221/221**.

See [R3 exact-SHA real WebKit evidence](docs/R3_REAL_WEBKIT_WINDOWS_QA_2026-10-14.md).
**Actual Apple Safari/iPhone and NVDA/VoiceOver human acceptance remains
G05 OPEN**; WebKit engine QA and automated axe do not substitute
for human assistive technology or a production release.

## G04 clipboard-source consistency (15 October)

In source-only PR following #75, async Safari-style clipboard permission results are ignored after the selected public GitHub repository changes. Three copy handlers check a per-selection generation to prevent a copied notice or old fallback from reappearing on a new repo. An intercepted mobile Playwright scenario tests delayed permission success **and** denial: **12/12 Chromium, 12/12 Firefox**, 227/227 Node, 16/16 offline HTTP; WebKit 12th scenario **NOT RUN** because the connected host was offline. Read the [exact-SHA test evidence](docs/G04_CLIPBOARD_SOURCE_SWITCH_RACE_QA_2026-10-15.md). This is not deployed to the still-older SSO Preview; G04/G05/G06 live acceptance remains OPEN.

## 15 October: NEXUS DevOps single-project execution plan

**Only this repository is in scope:** `senanurcetin/nexus-devops-intelligence`.
The [15 October execution plan](docs/NEXUS_SINGLE_PROJECT_EXECUTION_PLAN_2026-10-15.md)
tracks verified source `27018f829a6f1ba1f6e30ca21939138199ead164`,
P0 protected Preview G04 and independent-instance Redis G06, G05 human
accessibility, real-user performance and separately authorized Production.
Previous 14 October ledger entries are **historical evidence**, not the
current source SHA. The existing protected Preview/Production are older
than source main; merging docs/code does not automatically deploy them.

## Current release blockers and safe next actions (14 October 2026)

[Latest gate-by-gate closure ledger](docs/NEXUS_RELEASE_BLOCKER_CLOSURE_2026-10-14.md):
source G04 response diagnostics and R11 local lab passed on exact SHA
`8bb2e7c...` and were merged in PR #70. The existing protected
Preview still runs **older application SHA `2b5fb7c...`**. An
attempt to create a **second** source-exact SSO Preview after permission
to proceed within Free quotas was **blocked by platform safety controls**;
deployment list confirmed no new release. This has **not** been bypassed.
Full authenticated F01–F05, real Safari/assistive
technology, independently verified Redis instance enforcement and
separate Production authorization remain OPEN.

## Copyable, zero-request safe HTTP diagnostics for mobile Safari

The G04 source-coverage disclosure now includes **Copy safe diagnostics · no API requests**. It copies only previously observed, strictly allowlisted Actions/PR HTTP statuses, CDN class and admission details; **no source URL, cookie, token, IP, server error body or other raw header** can enter the generated five-line summary. iOS/Safari clipboard permission failures are handled by an accessible readonly textarea for manual copying. It **never** triggers an additional GET, refresh, API, Redis or telemetry request. The report explicitly states it is **not SSO or distributed Redis proof**.

On exact tested source `56c23805a55ec553d1e08a8d1e0451c01efc5e66`: **227/227 Node**, **16/16 local HTTP**, **11/11 Chromium**, **11/11 Firefox**, TypeScript/Next build/bundle budget and audit 0. See [G04 mobile evidence-transfer QA](docs/G04_COPY_SAFE_DIAGNOSTICS_2026-10-14.md). **Code only, not present on the older deployed Preview.**

## Source-response acceptance without DevTools; local performance QA (G04/R11)

The two initial source panels now have a native **Request diagnostics ·
no new requests** disclosure under source coverage. It shows only
allowlisted response **HTTP status**, CDN cache class and public
rate-limit mode/source from already completed requests; malformed headers,
cookies, IPs, tokens, raw error HTML and unknown header values are never
shown. Opening it sends **zero** additional GETs; `MISS` and
`shared-redis` are explicitly **not cross-instance/SSO proof**.
This addresses the user's inability to locate Chrome DevTools Network,
without adding an analytics backend or consuming more Upstash Free
admissions.

`npm run perf:local` (requires manual optional `playwright-core@1.64.0`)
collects loopback-only Chromium laboratory FCP/LCP/CLS and two-panel
timings on **intercepted static GitHub fixtures**, never a live
Preview/Production URL. 375/1280px, three runs each:
**253/281ms** source panels ready (median); **136/200ms** FCP and LCP;
**0.01129/0.00325** CLS. These are **synthetic local lab measurements,
not actual field Web Vitals**.
On executable SHA `8bb2e7c2fc664d051f4d34d0c02b8ee4cc7494c3`:
**221/221 Node, 16/16 local HTTP, 11/11 Chromium, 11/11 Firefox**,
typecheck/build/asset budget and audit 0. Read the
[G04/R11 measurement and release-gap report](docs/G04_R11_SAFE_RECEIPTS_PERFORMANCE_QA_2026-10-14.md).

**Source-only:** the latest deployed protected Preview still runs
`2b5fb7c379bd1f939f3b50f286edfb868ddb386a`;
the new receipt UI is **not yet deployed**, G04 live source acceptance,
R3 WebKit engine automated PASS; G05 real Safari/assistive technology and G06 Redis instances remain open.
There is no implicit Production or new Preview approval from merging code.

## Owner-approved current-source SSO Preview (G03)

The owner approved a **Preview-only exact-SHA deployment** and up to
**25 application-origin read requests**, excluding a live 21-request Redis
test, paid features and Production. The resulting [unique generated
Preview](https://nexus-devops-intelligence-jknosakps-senanurs-projects-102fb36c.vercel.app)
is Vercel `READY`, ID `dpl_9sq98XLM2DZAgyBFZoFVUde2NucT`,
GitHub application SHA `2b5fb7c379bd1f939f3b50f286edfb868ddb386a`,
`target:null` (Preview). The project's generated URL SSO
**configuration is enabled** and Production remains on older source.
**The authenticated Preview UI/API journeys are NOT VERIFIED**: available
tool-host DNS access failed before an HTTP response, and no SSO session
or live Redis proof was accessed. See
[G03 deployment evidence, user-browser G04 checklist and rollback
reference](docs/G03_PROTECTED_PREVIEW_ACCEPTANCE_2026-10-14.md).
No new Production deployment is authorized.

## Current-source offline release evidence (R1)

On exact GitHub `main` SHA `2df2ea635fd57b0d9f4d852818f6de55e0f1e3ce`
following the Redis diagnostic security repair: **208/208 Node tests,
16/16 loopback HTTP negatives, 11/11 Chromium and 11/11 Firefox
fixture scenarios**, TypeScript/Next production build/bundle budget
passed and audit reported **0** vulnerabilities. [Full exact-SHA
record](docs/R1_EXACT_MAIN_SOURCE_QA_2026-10-14.md).

**This is source-only acceptance**. Current deployed Preview/Production
remain older source SHAs. No new deployment, real Upstash Free probing,
WebKit/Safari/VoiceOver human test or Production release was performed.
The [master remediation plan](docs/NEXUS_MASTER_REMEDIATION_PLAN_2026-10-14.md)
keeps these separate owner-dependent gates open.

## Mobile evidence-first layout quality (R4)

The compact 320–640px NEXUS hero prioritizes the repository input while keeping
**both source receipt timestamps, the up-to-10 Actions/up-to-5 PR sample limit,
read-only data boundaries, and partial/error recovery** visible. Mobile share
guidance no longer occupies a cramped half-width text sidebar. The existing
11-scenario manual fixture browser suite now checks the 320/375px hero height,
repository search reachability and full-width share copy along with no
horizontal overflow or unexpected API calls.

Source-local **205/205 Node**, **16/16 local HTTP**, **11/11 Chromium** and
**11/11 Firefox** passed on executable SHA `2efaefcc27c8fafe8c5f2534ac34f3f59cd35f13`.
See [R4 visual/geometry QA](docs/R4_MOBILE_HIERARCHY_QA_2026-10-14.md).
**Real Safari, owner editorial signoff, aggregate Free quota and protected
Preview are still unverified**; merge does not deploy.

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

## 14 October owner-provided Free usage snapshot (R2 partial)

The owner supplied **six actual Upstash and Vercel Usage screen captures**:
shared Upstash Free **118/500K monthly commands**, **10 KB/10 GB**
bandwidth, **0 B / 250 MB** displayed storage and **$0.00**; entire
Vercel Hobby team 30-day **1.01 GB / 100 GB Fast Data Transfer**, **157.28
MB / 10 GB Fast Origin Transfer**, **23K CDN requests**, and **642 ISR reads**.
The NEXUS project-specific counters are also documented, but these
are **not** sufficient for a Vercel **Function Invocations, Active CPU or
Provisioned Memory** quota screen. The code's old historical 256 MB
Upstash storage assumption was reduced to the actual UI **250 MB**.
See the [R2 snapshot and missing-field decision](docs/R2_OWNER_USAGE_SNAPSHOT_2026-10-14.md).
**G02 remains INCOMPLETE** and no deployment or paid feature was enabled.

## Owner-data-free Upstash usage extraction (R2, opt-in)

The owner need not copy Upstash's current-month command, bandwidth or
storage numbers by hand. `npm run capacity:upstash:read-only -- --authorized-readonly --json`
can retrieve sanitized, whole-database figures from **the official Upstash
Management API** using separately authorized private account credentials
(`UPSTASH_MANAGEMENT_EMAIL`, `UPSTASH_MANAGEMENT_API_KEY` and
`UPSTASH_MANAGEMENT_DATABASE_ID`). It issues **two fixed management GETs**
and **zero Redis data-plane commands**; it does not read Vercel Redis
credentials, permit redirects, log secrets or run if the authorization flag
or account access is absent. No secret should be entered in a GitHub issue,
ChatGPT message or production project env.

This tool has not been used against the owner's real account because its
Management API authorization is **not connected**. Only local fake-API
contract tests passed (216/216 Node on exact code SHA
`d234e9d4f62ec7ed0f97ed05462700b7aa0ef224`). It reports only
`UPSTASH_ONLY_VERIFIED`; it **cannot certify G02 or authorize a
deployment**, because the entire Vercel Hobby TEAM usage also needs
an authorized source. [Full usage-fetcher evidence and constraints](docs/R2_AUTOMATED_UPSTASH_MANAGEMENT_USAGE_2026-10-14.md).

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
