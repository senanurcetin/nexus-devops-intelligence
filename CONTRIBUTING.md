# Contributing to NEXUS DevOps Intelligence

Contributions are welcome as small, independently reviewable changes to this **public, MIT-licensed, read-only GitHub developer tool**. Opening a PR triggers the existing [Node quality GitHub Actions](.github/workflows/ci.yml), but it does not request Production deployment, live load tests or a paid cloud service. Do not manually dispatch additional workflows or expand CI scope/cost without review. Read the [first contributor guide](docs/COMMUNITY_FIRST_CONTRIBUTION.md), [architecture](docs/architecture.md), [security policy](SECURITY.md) and [release NO-GO](docs/NEXUS_COMMUNITY_RELEASE_DECISION_2026-10-18.md).

## Before editing

1. Check an existing issue **and** open PRs for duplicates; propose an issue with expected/observed behavior and safe reproduction if no issue exists. Confirm scope before building. Bug reports and feature requests now use [structured GitHub issue forms](https://github.com/senanurcetin/nexus-devops-intelligence/issues/new/choose) (merged via [#82](https://github.com/senanurcetin/nexus-devops-intelligence/pull/82)); report security concerns privately via [SECURITY.md](SECURITY.md).
2. Fork or branch from a known `main` commit and record the full SHA. Node >=22.16 and the committed lockfile are prerequisites for current source work.
3. Keep the change small and support it with tests using **synthetic fixtures and injected GitHub fetches**, not live API requests, customer data or credentials.

## Source verification

```bash
npm ci
npm test
npm run typecheck
npm run build
```

Run these commands on the **actual** patched head, record exit codes and test failures, and report any command that could not run as **NOT RUN**. The current `package.json` has no `npm run lint` script; do not claim lint passed. For dependency security, run `npm audit --omit=dev` and `npm audit` when npm registry access is available, and record date/versions/findings rather than recycling historical clean results. A document-only source inspection does **not** certify Docker, application runtime, vulnerabilities or release readiness.

For Docker packaging, consult [merged PR #80](https://github.com/senanurcetin/nexus-devops-intelligence/pull/80), [open OS acceptance #81](https://github.com/senanurcetin/nexus-devops-intelligence/issues/81), and the [manual maintenance/release playbook](docs/COMMUNITY_MAINTENANCE_AND_RELEASE.md). Existing GitHub Actions performs **source-quality validation only**; Docker runtime acceptance, Production, Preview, Redis stress, release tagging and manual workflow dispatch remain separately gated.

## PR description and human review

- State the issue/scope, changed source files, intended behavior, risks, dependencies and full commit SHA.
- Show **exact** test commands with PASS/FAIL/NOT RUN and linked or sanitized evidence. Explain remaining unknowns; do not label unexecuted CI or test suites PASS.
- Include a truthful AI-assistance disclosure where applicable: tools used, which material they helped create and what the human contributor actually reviewed/tested. Maintain copyright/licensing authority and substantive human responsibility.
- Do not post unrelated trigger commits, request reviewer attention without a concrete need, alter the MIT license, widen public network access or change billing/deployment on a routine code PR.

## Privacy and security

**Never** post tokens, private repo URLs, protected build logs, actual end-user data, credentials, customer evidence, private installation details or unredacted security exploit details in public issues, diffs or release notes. Prefer synthetic public-data examples. Use [SECURITY.md](SECURITY.md) for **private** vulnerability reporting.

## Maintenance and release

NEXUS now has an automatic, least-privilege [GitHub Actions Node quality workflow](.github/workflows/ci.yml) for PRs and `main`, plus optional local verification. For example, [PR #100's exact-head run](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41116629184) passed clean `npm ci`, 389/389 Node tests, typecheck and build on Node 24. This confirms source quality **for that SHA only**, not a Docker or production release. Release claims require an immutable source SHA, reproducible install, independent acceptance tests, image digest, explicit owner approval, truthful changelog, an actual supported OS matrix and rollback evidence. A Git merge is **not** deployment or permission to publish. See the [release go/no-go ledger](docs/NEXUS_COMMUNITY_RELEASE_DECISION_2026-10-18.md).

New contributors can use the [safe walkthrough and source map](docs/COMMUNITY_FIRST_CONTRIBUTION.md) to find a focused, testable task.
