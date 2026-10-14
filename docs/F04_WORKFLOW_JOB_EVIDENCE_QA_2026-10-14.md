# F-04 phase 2 — on-demand workflow job and step evidence

**Date:** 14 October 2026 · **State:** source implementation and bounded offline QA completed; **not deployed**.

## Motivation and API budget

NEXUS already shows up to ten sampled public GitHub Actions runs and permits on-demand check/review detail for a sampled PR (F-04 phase 1). The previous Actions entries exposed only the GitHub run conclusion and original link, not the job or step statuses that help a human narrow an investigation.

The official GitHub REST [workflow-run detail](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run) and [list jobs for a workflow run attempt](https://docs.github.com/en/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run-attempt) endpoints work for public repositories without authentication. The **anonymous per-IP 60-requests-per-hour GitHub primary rate limit** and secondary limits still apply; do **not** automatically query all ten sampled runs or download raw logs.

| Action | Additional NEXUS origin GETs | Shared Redis admissions on a configured Vercel origin | Additional GitHub upstream GETs, uncached worst case |
| --- | ---: | ---: | ---: |
| Initial dashboard load / F-03 share-link hydration | **0 from phase 2** | **0 additional** | **0 additional** |
| Filter source samples, export CSV/JSON, or render investigation queue | **0** | **0** | **0** |
| Explicit **Inspect job & step evidence** for one confirmed failed sampled workflow | **1** | **1** | **max 2 sequential** |
| Collapse/reopen same successfully fetched run evidence | **0** | **0** | **0** |
| Switch repositories or refresh Actions | **0 new detail requests** | **0 new detail requests** | **0 new detail requests** |

Existing ordinary repository selection remains **two NEXUS origin GETs / at most seven GitHub GETs** (Q-05); normal PR check/review detail remains **one origin + at most three upstream GETs** (F-04 phase 1). Phase 2 does **not** run automatically.

## Implementation

- New read-only `GET /api/public-workflow-evidence?repository=owner%2Frepo&id=91` accepts **exactly one** canonical public repository and positive bounded run ID, rejects duplicated/extra/malformed parameters with **HTTP 400 and no upstream or Redis requests**.
- The route invokes the **existing shared Redis per-IP origin gate**, fail-closed **503** on configured Redis errors, **429** with bounded `Retry-After` when limited; process-local fallback applies only if shared Redis is genuinely not configured. A source-specific in-flight query key coalesces concurrent identical requests on a single Node process. No background tasks, automatic retries or new storage.
- **GET 1:** fetch the exact public run by ID; require the canonical `https://github.com/<owner>/<repo>/actions/runs/<id>` link, matching run ID, `completed` status, one of `failure`, `timed_out` or `startup_failure`, a validated 40-char head SHA, and valid `run_attempt`.
- **GET 2:** inspect the exact returned attempt at `/actions/runs/<id>/attempts/<attempt>/jobs?per_page=20&page=1`, not an unrelated rerun. A failed/mismatched first response **prevents** the second GET. Each job must match the requested run ID and attempt (when provided); IDs are checked for duplicates. Results include up to **20 jobs**, with the first **10 steps per job**, safely bounded text, explicit truncation indicators and the original GitHub run link.
- The client only offers the button for a **confirmed failed, already validated sampled run**. A successful detail result is reused on collapse/reopen. An Actions refresh, repository change or invalid shared link aborts and clears prior run detail. Read-only payloads are independently validated in the browser; no raw logs, job log redirect URLs, authorization tokens, GitHub write calls or inferred AI root-cause diagnosis enter the UI.

**Important limitations:** Job/step failures help prioritize human investigation but are **not proof of why a workflow failed**. Jobs can be truncated after twenty; steps can be truncated after ten. There may be reruns or re-evaluated GitHub states. A stale/changed run is rejected instead of displaying an unverified diagnosis. Only the owner’s legitimate GitHub access can resolve full logs and source changes.

## Manual CI-free verification

Temporary isolated **Node v24** Vercel Sandbox checked out feature branch SHA `2c4a283a8c7ff781b8ed2041c269955d9dba82a2`. The sandbox is not a protected Preview deployment.

| Check | Result |
| --- | --- |
| `npm ci` / `npm test` | **172/172 passed**, including nine F-04 phase 2 tests for the 2-GET limit, attempt binding, source mismatch, 429, fake Redis, malformed payload, truncation and on-click-only behavior |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS**; new dynamic `/api/public-workflow-evidence` route built |
| `npm run inspect:budget` | **425,386 raw / 123,336 gzip bytes** for 6 unique Next page JS chunks; under existing review thresholds **537,600 / 163,840** |
| `npm audit --json` | **0 vulnerabilities at inspection time** |
| Chromium **375px** — populated failed run | 2 initial intercepted Actions/PR calls + **exactly one** manually triggered detail API GET; selected attempt, failed job/step and history disclaimer appeared. Collapse/reopen reused result (**0** further calls). **0 axe WCAG A/AA violations** (29 passing rules). |
| Chromium **1280px** — source 429 | Safe 47-second retry notice with no fabricated partial evidence, **0** axe A/AA violations (28 passing rules) |
| Chromium **375px** — changed repository | Old failed-run detail cleared on new repository selection. **0** additional detail GETs, **0** axe A/AA violations (26 passing rules) |
| Browser JS exceptions / horizontal overflow | **0** in all completed Chromium scenarios |
| Shared Redis offline fixture | Allowed origin requested one synthetic atomic Redis admission; denied 429 incurred **0 subsequent GitHub upstream calls**; **no real Upstash** |
| Unmocked live GitHub / Production | **Not attempted**. Previous F-04 phase 1 public smoke received upstream anonymous GitHub 429, and user forbids shared Upstash/Production stress. Mock results are not production integration acceptance. |

Two early test errors were corrected before final pass: a malformed string-expression in the new test-only assertion and a Q-04 structural test checking a hardcoded old CSS class instead of the equivalent updated responsive Actions row. No unverified test was counted as passing.

## Release / next backlog

- **F-04 phases 1 and 2:** source-implemented, manually verified offline. Actual source data and job/step results on a newly authorized SSO Preview **not verified**. F-01/02/03 similarly remain GitHub-only.
- **F-05:** historical run/PR trend analytics **not implemented**. The existing 10-run sample does not establish an evenly spaced trend or a reliable full-period metric. Any time-series analytics require an explicitly cost-reviewed source and sample/window validity.
- **R-04/R-05/R-06:** owner-authenticated Preview visual/runtime tests, human Safari/screen-reader/device signoff and independent live Vercel Redis proof remain pending; issue [#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) stays open.
- Current protected Preview continues serving **`599ced7`**, Production **`74cd0e3`**. Git auto-deploy is disabled and this development work is **not** approval to deploy. No hosted GitHub Actions/CircleCI, paid plans, secret inspection, SSO bypass, WAF/env changes, Upstash quota stress or Production request.
