# NEXUS DevOps Intelligence — CI-free delivery plan

**Baseline:** 13 October 2026 · **Repository:** `senanurcetin/nexus-devops-intelligence` · **Delivery mode:** manual, local verification only.

## Non-negotiable constraints

- No GitHub Actions, CircleCI, GitLab CI or other hosted pipeline runs. Do not add `.github/workflows/**` or `.circleci/**` files until the owner explicitly reverses this constraint.
- Do not merge an untested feature or report a successful build without a real `npm run build` result.
- Never expose GitHub tokens in browser bundles, examples, logs or issues. The initial product accesses **public** repositories only through anonymous, bounded GET requests.
- Treat GitHub PR mergeability as potentially pending/stale; never fabricate a passing CI status, security verdict or billed-minute estimate.
- Keep this product and its repository independent from the industrial AI assistant Ops-Copilot.

## Phase 0 — Independent foundation (P0)

- [x] Create dedicated public repository and initialize a clean `main` branch.
- [x] Add standalone Next.js source, two read-only API routes, responsive dashboard and shared validation models.
- [x] Add license, `README.md`, `CONTRIBUTING.md`, `SECURITY.md` and architecture notes.
- [x] Make Node.js 22 built-in TypeScript stripping usable for tests without project dependencies.
- [x] Run `npm test` locally: **7 passed, 0 failed** (13 October 2026).
- [x] Run focused dependency-free TypeScript model check with global `tsc`: **passed**.
- [ ] Install pinned project dependencies and generate/commit a reproducible `package-lock.json`.
- [ ] Run full `npm run typecheck` and `npm run build` **locally**. Current runtime cannot resolve npmjs.org (`EAI_AGAIN`); these checks are *not yet verified*.

## Phase 1 — Data and API hardening (P0)

- [ ] Add mock-based route tests: valid empty responses, 404, 429/503, malformed payload, timeouts and partial PR-detail failure.
- [ ] Verify UI correctly distinguishes `unknown`, `blocked`, `dirty`, `behind`, `unstable` and draft PRs using real GitHub API sample data.
- [ ] Review anonymous rate-limit behavior, bounded fan-out, caching isolation and XSS/URL-validation boundaries.
- [ ] Confirm accessibility in a local browser: keyboard operation, loading and error states, narrow mobile viewport.

## Phase 2 — Publishable free MVP (P1)

- [ ] Verify a clean local production build and inspect browser console warnings.
- [ ] Publish an isolated preview using an authorized hosting project when hosting quota permits. No CI pipeline or automatic deployment is needed.
- [ ] Publish a versioned changelog and precise release notes based only on tests actually run.
- [ ] Collect early user feedback from public GitHub repository maintainers.

## Phase 3 — Post-MVP expansion (P2)

- [ ] Add optional GitHub App authentication for private repos with **least-privilege, read-only** permissions, registered by the account owner.
- [ ] Add CircleCI data integration after explicitly agreeing on API permissions and data-retention boundaries. This is **data ingestion**, not running CircleCI builds.
- [ ] Add historical PR/CI health trends and evidence-backed diagnostic suggestions.
- [ ] Consider AI-assisted incident explanations only after sufficient log redaction, provenance and user feedback.

## Commands: manual and quota-free

```bash
npm test
# Requires dependencies; execute only when package installation is available:
npm run typecheck
npm run build
npm run dev
```

`npm test` uses Node.js 22 and its built-in type stripping; no CI service is invoked. Build verification is a separate local task; passing seven model tests does **not** demonstrate that Next.js renders or deploys successfully.

## Acceptance criterion for calling the MVP complete

A fresh clone installs with a committed lockfile, all tests and typechecks pass on an authorized developer machine, a production build completes, API errors fail safely, and the page is manually verified on desktop and mobile. Deployment and public availability are separate from source readiness.
