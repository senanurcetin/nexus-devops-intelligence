# NEXUS DevOps Intelligence

## At a glance

**What it is:** a read-only GitHub API integration for public repositories. It samples recent GitHub Actions runs and open pull requests, and reports the check/status records for one exact commit SHA — with source links and explicit unknown/partial states instead of guesses.

**What it is not:** it never writes to GitHub, needs no token or GitHub App install, and reads no private repositories.

### Quick start (dashboard)

Requires Node.js 22.16+.

```bash
git clone https://github.com/senanurcetin/nexus-devops-intelligence.git
cd nexus-devops-intelligence
npm ci
npm run dev
# open http://localhost:3000 and enter owner/repo
```

### Quick start (commit-checks CLI)

```bash
node scripts/jarvis-commit-checks.mjs owner/repo FULL_COMMIT_SHA
node scripts/jarvis-commit-checks.mjs --json owner/repo FULL_COMMIT_SHA
```

Exit codes: `0` no failing record in the available sample, `1` at least one failing record, `2` usage/validation error, `3` no verified source.

Anonymous GitHub API requests are rate-limited by GitHub (60 requests/hour per IP), so large or repeated audits can return partial results.


### Quick start (GitHub Action)

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

### Support

- Questions and bugs: [open an issue](https://github.com/senanurcetin/nexus-devops-intelligence/issues/new/choose) or email senanur.cetin.work@gmail.com.
- Security reports: follow [SECURITY.md](SECURITY.md) — never post tokens or private CI logs in public issues.
- Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Self-hosted Docker candidate (not yet accepted): [docs/COMMUNITY_SELF_HOSTED.md](docs/COMMUNITY_SELF_HOSTED.md).

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
