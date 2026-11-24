# NEXUS DevOps Intelligence

[![Node quality](https://github.com/senanurcetin/nexus-devops-intelligence/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/senanurcetin/nexus-devops-intelligence/actions/workflows/ci.yml) [![CodeQL](https://github.com/senanurcetin/nexus-devops-intelligence/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/senanurcetin/nexus-devops-intelligence/actions/workflows/codeql.yml) [![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/senanurcetin/nexus-devops-intelligence/badge)](https://scorecard.dev/viewer/?uri=github.com/senanurcetin/nexus-devops-intelligence) [![Release](https://img.shields.io/github/v/release/senanurcetin/nexus-devops-intelligence)](https://github.com/senanurcetin/nexus-devops-intelligence/releases/latest) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## At a glance

**What it is:** a read-only GitHub API integration for public repositories. It samples recent GitHub Actions runs and open pull requests, and reports the check/status records for one exact commit SHA — with source links and explicit unknown/partial states instead of guesses.

**What it is not:** it never writes to GitHub, needs no token or GitHub App install, and reads no private repositories.

### Quick start (GitHub Action) — [Marketplace](https://github.com/marketplace/actions/nexus-commit-checks)

Summarize the checks and commit statuses on a commit inside any workflow. The action only sends GET requests to `api.github.com`, needs no `npm install`, and writes a table to the job summary.

```yaml
permissions:
  contents: read
  checks: read
  statuses: read

steps:
  - id: nexus
    uses: senanurcetin/nexus-devops-intelligence@v0.2.0
    with:
      repository: owner/repo        # default: the current repository
      sha: ${{ github.sha }}        # default: PR head SHA, else github.sha
      fail-on-failure: "true"       # fail the step if a failing record is observed
  - run: echo "failing=${{ steps.nexus.outputs.failure-count }} coverage=${{ steps.nexus.outputs.coverage }}"
```

Outputs: `coverage`, `failure-count`, `pending-count`, `success-count`. When the action targets the commit its own workflow is running on, that workflow appears as pending.

**Example job summary** — real output for commit [`2397f4b`](https://github.com/senanurcetin/nexus-devops-intelligence/commit/2397f4ba10001e3126760ba8b033cad43658b261) of this repository, where CodeQL failed (with `fail-on-failure: "true"` the step exits 1):

> ### NEXUS commit checks
>
> `senanurcetin/nexus-devops-intelligence@2397f4ba1000` · coverage: **both_sources**
>
> | Failing | Pending | Passing |
> | --- | --- | --- |
> | 1 | 0 | 3 |
>
> | Provider | Outcome | Check | Next step |
> | --- | --- | --- | --- |
> | other | failure | [CodeQL](https://github.com/senanurcetin/nexus-devops-intelligence/commit/2397f4ba10001e3126760ba8b033cad43658b261/checks) | Open the original check or commit-status details; this summary does not include logs. |

### Quick start (commit-checks CLI)

```bash
node scripts/jarvis-commit-checks.mjs --help  # or -h
node scripts/jarvis-commit-checks.mjs --version
node scripts/jarvis-commit-checks.mjs owner/repo FULL_COMMIT_SHA
node scripts/jarvis-commit-checks.mjs --json owner/repo FULL_COMMIT_SHA
```

Both informational flags exit `0` without contacting GitHub. For commit checks, `0` means no failing record in the available sample, `1` means at least one failing record, `2` means a usage or validation error, and `3` means no verified source.

Anonymous GitHub API requests are rate-limited by GitHub (60 requests/hour per IP), so large or repeated audits can return partial results.


### Quick start (dashboard)

Requires Node.js 22.16+.

```bash
git clone https://github.com/senanurcetin/nexus-devops-intelligence.git
cd nexus-devops-intelligence
npm ci
npm run dev
# open http://localhost:3000 and enter owner/repo
```

### Support

- Questions: [GitHub Discussions](https://github.com/senanurcetin/nexus-devops-intelligence/discussions). Bugs: [open an issue](https://github.com/senanurcetin/nexus-devops-intelligence/issues/new/choose). Full guide: [SUPPORT.md](SUPPORT.md).
- Direct contact: senanur.cetin.work@gmail.com.
- Security reports: follow [SECURITY.md](SECURITY.md) — never post tokens or private CI logs in public issues.
- Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Self-hosted Docker candidate (not yet accepted): [docs/COMMUNITY_SELF_HOSTED.md](docs/COMMUNITY_SELF_HOSTED.md).

## GitHub integration

NEXUS DevOps Intelligence is a **read-only integration with the GitHub REST API**
(`https://api.github.com`, API version `2022-11-28`). It never sends `POST`,
`PATCH`, `PUT` or `DELETE` requests and uses no GraphQL mutations.

| Surface | GitHub REST endpoints (all `GET`) |
| --- | --- |
| GitHub Action / `nexus-commit-checks` CLI | `/repos/{owner}/{repo}/commits/{sha}/check-runs`, `/repos/{owner}/{repo}/commits/{sha}/status` |
| Dashboard: Actions sample, trends, failed-run detail | `/repos/{owner}/{repo}/actions/runs`, `/repos/{owner}/{repo}/actions/runs/{id}/attempts/{n}/jobs` |
| Dashboard: open PR sample and PR verification | `/repos/{owner}/{repo}/pulls`, `/repos/{owner}/{repo}/pulls/{number}`, `/repos/{owner}/{repo}/pulls/{number}/reviews`, `/repos/{owner}/{repo}/commits/{sha}/check-runs` |
| Maintainer audit scripts (`scripts/oss-*.mjs`) | `/repos/{owner}/{repo}`, `/users/{username}`, `/search/issues` |

**Authentication model**

- The dashboard and its [HTTP API](#http-api) call GitHub **anonymously**. The web
  routes never read a token, even if one is set on the server.
- The GitHub Action uses the workflow's `GITHUB_TOKEN` by default (pass
  `token: ""` to run anonymously). The token is sent only as a `Bearer` header to
  `api.github.com`, only for the two read requests above, and never logged.
- The CLI uses `NEXUS_GITHUB_TOKEN` only when `NEXUS_DEVOPS_ALLOW_GITHUB_TOKEN=1`
  is also set. No GitHub App or OAuth App installation is needed.

**Scopes and permissions:** read-only. In a workflow, `permissions: checks: read`
plus `statuses: read` (or the default `contents: read` on public repositories)
is enough. The project requests no write scope and stores no credentials.

**Rate limits:** GitHub allows 60 anonymous requests per hour per IP and 1,000
per hour per repository for `GITHUB_TOKEN`. The integration keeps request counts
bounded (at most six upstream requests per PR-sample cache miss, two per commit
check, one page per list call, no automatic pagination), caches web responses
for two minutes, honours `Retry-After` and `x-ratelimit-remaining`, and reports
HTTP 403/429 as an explicit `rate_limited` state instead of partial data.

**Support:** see [SUPPORT.md](SUPPORT.md) — GitHub Discussions for questions,
GitHub Issues for bugs, and [SECURITY.md](SECURITY.md) for vulnerabilities.

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

**Source-quality workflow (30 Oct 2026):** PRs and `main` pushes run the existing
[read-only Node quality workflow](.github/workflows/ci.yml), with `npm ci`,
`npm test`, `npm run typecheck` and `npm run build` on Node 24. The
[verified PR #100 run](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41116629184)
completed successfully with 389/389 tests. This is **not** live runtime,
Docker/Ubuntu, accessibility, Preview/Production or release acceptance.
Developers may also reproduce these commands locally with the locked `tsx`
dependency. Reading the public repository needs no installation.

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

## Project history

The dated release, QA and acceptance records that used to live in this README are kept verbatim in [docs/STATUS_HISTORY.md](docs/STATUS_HISTORY.md). They describe older commits and are not statements about the current release.
