# NEXUS DevOps Intelligence

An independent, read-only dashboard for inspecting recent GitHub Actions workflow runs
and pull request merge state. **This is not part of Ops-Copilot.**

> **Verified MVP development build (13 October 2026):** [PR #3](https://github.com/senanurcetin/nexus-devops-intelligence/pull/3)
> upgraded Next.js; [PR #6](https://github.com/senanurcetin/nexus-devops-intelligence/pull/6)
> migrated Tailwind to 4.3.3 and fixed secondary-text contrast. Clean cloud `npm ci`,
> **39/39 tests**, full TypeScript and production build passed. Full `npm audit`
> (including development dependencies) reported **zero findings at the time checked**.
> Chromium 375/768/1440 responsive checks and automated axe-core A/AA tests passed.
> **No public deployment:** Vercel WAF cross-instance rate limiting and final manual
> release QA remain pending. No GitHub Actions or CircleCI were run.

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

**CI-free workflow:** Tests, typecheck and production build are run manually in a
short-lived cloud sandbox, without GitHub Actions or CircleCI. The current
`npm test` command uses the locked `tsx` development dependency and requires
`npm ci` first. There is no requirement to install anything on the user's PC.

## CI-free browser verification

The [manual Tailwind 4 browser/a11y report](docs/tailwind4-browser-audit-2026-10-13.md)
covers Chromium screen widths, invalid repository validation, rapid repo switching,
and an axe-core WCAG 2/2.1 A/AA scan. These manual checks are separate from the
33 automated Node.js tests and require no GitHub Actions or CircleCI.

**Release gate:** Before serving broad public traffic, configure a platform-wide
rate limit covering both APIs ([issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7)).
The current request gate is per Node process only. Vercel Hobby WAF configuration,
its usage terms, manual preview and remaining accessibility checks are not complete.

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

The current project is an **MVP source distribution**, not a deployed service or
production-grade security monitor. The Next.js production build was verified using the committed dependency lockfile;
interactive browser QA and public deployment are still pending.

## Roadmap

1. Responsive browser QA and route-level failure testing.
2. Dedicated deployment, URL, and release checklist.
3. Better PR check-run details, CI incident classification and historical trends.
4. Optional least-privilege GitHub App, CircleCI integration and AI assistance.

## Support and security

General contact: senanur.cetin.work@gmail.com.
Do not disclose GitHub tokens or private CI logs in public issues.

## Cloud verification (13 October 2026)

The independent NEXUS repository was cloned into a temporary Vercel Sandbox (Node 24 / npm 11) and **checked manually without GitHub Actions or CircleCI**:

- `npm install --no-audit --no-fund` — 108 packages installed successfully
- `npm test` — 24 tests passed, zero failures (latest source)
- `npm run typecheck` — passed
- `npm run build` — Next.js 15.5.9 production build passed
- HTTP smoke test: `/` returned 200, Actions and PR API endpoints returned 200 with live public GitHub responses, malformed repository input returned 400
- Additional populated-source probes: ten workflow runs from `senanurcetin/ot-sentinel`, five open PRs from `vercel/next.js`

**Status limitations:** these results are a manual cloud verification of the source at `e51b38057dbc3be35fed4020e7b42434071c7783`, not a publicly deployed production service or browser accessibility audit. The dependency lockfile is committed (`4b87e6d`), and `npm ci` and Next.js production build have been verified against the latest source (`e51b380`). Vercel deployment and hosting have not been enabled.
