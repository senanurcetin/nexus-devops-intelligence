# Support

NEXUS DevOps Intelligence is maintained in public on GitHub. All support happens
there, so answers stay searchable for the next person.

| You need… | Go to |
| --- | --- |
| A question, setup help or an idea to discuss | [GitHub Discussions](https://github.com/senanurcetin/nexus-devops-intelligence/discussions) |
| To report a reproducible bug | [Open a bug report](https://github.com/senanurcetin/nexus-devops-intelligence/issues/new/choose) |
| To request a feature | [Open a feature request](https://github.com/senanurcetin/nexus-devops-intelligence/issues/new/choose) |
| To report a security vulnerability | Follow [SECURITY.md](SECURITY.md) and use [private vulnerability reporting](https://github.com/senanurcetin/nexus-devops-intelligence/security/policy) — never a public issue |
| To contribute code or docs | [CONTRIBUTING.md](CONTRIBUTING.md) and issues labelled [`good first issue`](https://github.com/senanurcetin/nexus-devops-intelligence/labels/good%20first%20issue) |

## What to include

- The repository (`owner/repo`) and, for commit checks, the full 40-character commit SHA.
- Which surface you used: the GitHub Action, the `nexus-commit-checks` CLI, the dashboard or the HTTP API.
- The exact output or error text, and your Node.js version for local runs.

Never paste tokens, private CI logs or customer data into an issue or discussion.

## Scope

This integration only reads from the GitHub REST API (see
[GitHub integration](README.md#github-integration)). It cannot change
repositories, re-run workflows or read private data unless you pass your own
token to the GitHub Action. Rate-limit responses from GitHub (HTTP 403/429)
are reported as `rate_limited`, not as bugs in this project.

## Response times

This is a volunteer-maintained project. Issues and discussions are usually
triaged within a few working days; security reports are prioritised as described
in [SECURITY.md](SECURITY.md).
