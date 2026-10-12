# NEXUS DevOps Intelligence — CI-free delivery roadmap

**Updated:** 13 October 2026  
**Repository:** https://github.com/senanurcetin/nexus-devops-intelligence  
**Product boundary:** Standalone developer application; no dependency on Ops-Copilot.

## Verified baseline

- [x] Dedicated public GitHub repository with standalone Next.js 15.5.9 application.
- [x] GitHub Actions activity viewer, PR merge-state triage, and source-linked investigation recommendations.
- [x] Read-only anonymous REST API access, fixed GitHub host, bounded fan-out, repository and upstream-link validation.
- [x] Documentation: README, architecture, contribution guidelines, security policy, MIT license.
- [x] **24/24 Node.js unit tests passed** on a temporary Vercel cloud sandbox.
- [x] **Full `npm run typecheck` passed**, and **`npm run build` passed** in that sandbox (Node 24 / npm 11).
- [x] Production server manually returned **HTTP 200** for the homepage and API endpoints; malformed repo input returned HTTP 400.
- [x] Live public API probes returned 10 Actions runs from `senanurcetin/ot-sentinel` and 5 PRs from `vercel/next.js`.
- [x] Temporary Vercel Sandbox stopped after the checks.
- [x] No GitHub Actions or CircleCI jobs were started; no CI workflow files exist.
- [x] **`package-lock.json` committed** in `4b87e6d`, verified byte-for-byte against the generated lockfile and installed with `npm ci`.
- [ ] Full interactive browser QA and production deployment are not complete.

The latest complete unit tests, full typecheck and build were verified against commit `e51b38057dbc3be35fed4020e7b42434071c7783`, using the committed npm lockfile. Logs were observed in a temporary cloud sandbox, not a CI service.

## Non-negotiable delivery constraints

1. **Do not run, configure or trigger GitHub Actions, CircleCI, GitLab CI, or automatic CI workflows.** Do not add `.github/workflows/` or `.circleci/` configuration without explicit permission.
2. The user cannot install software locally. **Do not make the user's PC a prerequisite.** Use connected GitHub, short-lived cloud sandboxes and available cloud testing services when permitted.
3. Do not deploy automatically on every push. Keep deployment a separate, reviewed operation.
4. Never expose GitHub tokens or installation secrets in browser code, examples, logs, or GitHub issues. Public MVP stays anonymous and GET-only.
5. Report only observed test/build outcomes; do not conflate sampled run durations with billed GitHub Actions minutes or an exhaustive CI health score.
6. Do not describe pending or unverified PR mergeability as safe to merge.
7. Verify Vercel plan limits and resource consumption before repeating sandbox work. Stop sessions promptly.

## Phase 1 — Reproducible foundation (P0)

- [x] Regenerated and committed `package-lock.json` (commit `4b87e6d`); validated byte-for-byte against cloud-generated lockfile.
- [x] After pulling committed lockfile, `npm ci --no-audit --no-fund` completed successfully (108 packages); the local snapshot matched GitHub's lockfile byte-for-byte.
- [x] Repeated `npm test` (23/23), `npm run typecheck` (passed) and `npm run build` (passed, Next.js 15.5.9) using the committed lockfile in temporary Vercel Sandbox (Node 24, npm 11).
- [ ] Review dependency scripts and the lockfile before committing. Avoid installing additional services or CI runners.

**Acceptance:** Fresh cloud checkout reproduces all 23 tests, typecheck and production build using `npm ci` with no lockfile drift.

## Phase 2 — API reliability and security (P0)

A manually invoked HTTP smoke script is available as `npm run smoke:http` against a separately started `npm run start` server. It is not a CI job.

- [ ] Add focused Next.js route-handler integration tests with mocked upstream failures; the manual HTTP smoke script checks actual Next.js HTTP endpoints, while 24 unit tests exercise domain models and fetch adapters.
- [ ] Extend endpoint-level tests for 400, 404, 429, 502 and 503; the core adapter tests already cover these faults and GitHub's 403 exhausted-quota header.
- [ ] Audit GitHub anonymous rate-limit handling, `Cache-Control` semantics and resource exhaustion risks under concurrent requests. Design safe limits and public endpoint abuse controls.
- [ ] Verify unknown, blocked, dirty, behind, unstable and draft PR categorization using fixtures; never fabricate merge-check outcomes.
- [ ] Validate any external hrefs and text display; keep auth tokens and response bodies out of logs.

**Acceptance:** Both routes fail safely under mocked faults, cap upstream requests, and show bounded, truthful public data.

## Phase 3 — Browser experience and accessibility (P1)

- [ ] Manually inspect desktop, tablet and mobile viewports; verify layouts and card readability.
- [ ] Test repository input, loading and empty states, API error banners, retry behavior, long repo names and result links.
- [ ] Verify keyboard navigation, focus visibility, form labels, color contrast, and screen-reader status updates.
- [ ] Check stale-request races when switching repos rapidly and ensure error states are independent across panels.
- [ ] Run a production-server browser smoke test in a cloud environment **without triggering CI**.

**Acceptance:** An independent user can paste a public repo, understand its sampled CI/PR status, and follow a traceable investigation recommendation on mobile or desktop.

## Phase 4 — Manual preview and release (P1)

- [ ] Review the already-created **separate Vercel project** for NEXUS; ensure it is not linked to Ops-Copilot, Git auto-deployment is off and current plan limits permit a preview.
- [ ] Publish one manually initiated preview after Phases 1–3 pass; do not enable push-triggered deployment.
- [ ] Confirm production-like API responses and client-side behavior at the actual preview URL.
- [ ] Add `CHANGELOG.md`, a release checklist, verified screenshots, support contact and explicit data/usage limitations.
- [ ] Tag an `v0.1.0` release only after source, verification and preview match.

**Acceptance:** A manually reviewed, accessible public preview has working real-data APIs and no unrelated CI execution.

## Phase 5 — Later capabilities (P2; exclude from initial MVP)

- GitHub App registration and least-privilege access to selected private repositories.
- Read-only CircleCI API data analysis **without running CircleCI builds**.
- Historical metrics with explicit sample-coverage and retention definitions.
- AI-assisted incident interpretation only with evidence links, redaction and user controls.
- GitHub Marketplace feasibility, packaged CLI, and commercial features after real user feedback.

## Current blockers and ownership

| Item | Status | Resolution |
| --- | --- | --- |
| npm lockfile | **Committed and verified** | GitHub commit `4b87e6d`; `npm ci` and production build passed |
| Full application test/build | **Verified after committed lockfile** | 23/23 tests, full TypeScript check and Next.js build passed |
| Interactive browser QA | Pending | Cloud browser / sandbox validation |
| Public preview | Pending | Manual Vercel deployment after reviewing quotas |
| CI minutes | **Not required** | No GitHub Actions or CircleCI |
| Local user machine | **Not required** | Use cloud and connected GitHub |

## Useful manual commands (cloud sandbox, not CI)

```bash
npm ci --no-audit --no-fund
npm test
npm run typecheck
npm run build
npm run start
```

**Latest manual smoke test:** `npm run smoke:http` passed against a locally started production server: homepage 200, invalid repository requests 400 and no-store, public Actions sample 10 runs and PR endpoint sample 5 open PRs. No CI.

**MVP completion definition:** Independent repository, reproducible dependency lock, passing unit and route tests, full typecheck and production build, responsive browser QA, secure bounded public API access, and a manually verified public preview. Keep advanced integrations out of the first release.
