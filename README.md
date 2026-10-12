# NEXUS DevOps Intelligence

An independent, read-only dashboard for inspecting recent GitHub Actions workflow runs
and pull request merge state. **This is not part of Ops-Copilot.**

## Current scope (MVP)

- Public GitHub repositories only; no GitHub token, GitHub App installation, or write permission.
- Recent workflow history (up to 10 runs); sample metrics **are not billed minutes**.
- Recent open pull requests (up to five), with GitHub-reported merge state.
- Explicit `unknown` statuses when GitHub has not finished calculating mergeability.
- Deterministic investigation suggestions linking to GitHub-confirmed workflow failures
  and PR merge states; no speculative log analysis or automatic code changes.
- URL validation, bounded requests, caching and request timeouts.
- No AI root-cause diagnosis, CircleCI integration, private repo access or live product deployment yet.

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

**CI-free workflow:** Run the tests and build on your own machine. This repository
does not contain any GitHub Actions or CircleCI workflow files. Tests use Node.js
22 built-in TypeScript type stripping and do not need third-party dependencies.

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

All mocks remain local; the tests do not call GitHub or CircleCI. A complete
Next.js build still requires project dependencies and has not been verified yet.

## Release limitations

The current project is an **MVP source distribution**, not a deployed service or
production-grade security monitor. Full Next.js build verification requires
installing the dependencies and is recorded separately.

## Roadmap

1. Full build/test verification and responsive browser QA.
2. Dedicated deployment, URL, and release checklist.
3. Better PR check-run details, CI incident classification and historical trends.
4. Optional least-privilege GitHub App, CircleCI integration and AI assistance.

## Support and security

General contact: senanur.cetin.work@gmail.com.
Do not disclose GitHub tokens or private CI logs in public issues.

## Cloud verification (13 October 2026)

The independent NEXUS repository was cloned into a temporary Vercel Sandbox (Node 24 / npm 11) and **checked manually without GitHub Actions or CircleCI**:

- `npm install --no-audit --no-fund` — 108 packages installed successfully
- `npm test` — 23 tests passed, zero failures
- `npm run typecheck` — passed
- `npm run build` — Next.js 15.5.9 production build passed
- HTTP smoke test: `/` returned 200, Actions and PR API endpoints returned 200 with live public GitHub responses, malformed repository input returned 400
- Additional populated-source probes: ten workflow runs from `senanurcetin/ot-sentinel`, five open PRs from `vercel/next.js`

**Status limitations:** these results are a manual cloud verification of the source at `30f40c65ea6d6100bd3fb7db551e6b8c50fc4d3a`, not a publicly deployed production service or browser accessibility audit. npm generated a lockfile inside the temporary cloud environment; reproducible dependency locking is still pending until that file is committed to this repository. Vercel deployment and hosting have not been enabled.
