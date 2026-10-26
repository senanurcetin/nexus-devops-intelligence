# First contribution and maintainer onboarding — NEXUS Community

**Status:** documentation for the source repository; **not** an assertion of a published Docker Community release. The first localhost-only installer exists only in [draft #80](https://github.com/senanurcetin/nexus-devops-intelligence/pull/80); structured issue and PR forms are now live on `main` after [merged #82](https://github.com/senanurcetin/nexus-devops-intelligence/pull/82). The Docker installer still needs separate runtime acceptance. Start with [CONTRIBUTING](../CONTRIBUTING.md) and [release decision](NEXUS_COMMUNITY_RELEASE_DECISION_2026-10-18.md).

## 1. What the product actually does

- One Next.js 15/React 19/TypeScript dashboard provides **read-only** GitHub Actions and pull-request evidence for **public** repositories.
- It sends bounded **anonymous GET** requests via the fixed-host GitHub API adapter; no GitHub write operations, OAuth, private repositories, app installations or token onboarding.
- It has five public API route families: `public-actions`, `public-prs`, `public-pr-verification`, `public-workflow-evidence`, `public-workflow-trends`. Inspect [architecture](architecture.md) before changing their failure/security contracts.
- Results are samples, not complete workflow counts, CI guarantees or diagnostic root causes. Unknown, inaccessible, stale or missing upstream data must never be silently called passing.
- The public MIT source is distinct from the owner-proposed future paid installation service and future-only Pro/Cloud modules. No checkout or premium code is assumed.

## 2. Development setup, not yet a tested public installer

```bash
git clone https://github.com/senanurcetin/nexus-devops-intelligence.git
cd nexus-devops-intelligence
node --version
npm --version
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

Use Node **22.16+**, a working network/npm registry and the committed `package-lock.json`. The commands are **instructions**, not recent execution evidence; consult [release decision](NEXUS_COMMUNITY_RELEASE_DECISION_2026-10-18.md). To work on changed files, create a personal branch and pin the baseline commit, then rerun affected tests. `npm run lint` is **not provided on audited main**; do not claim it passes.

## 3. A safe example workflow

**Example input:** `vega/altair` (a public GitHub repository; demonstration input only, not a verified live result).

1. Start the development app locally. Paste `vega/altair` into the repository field.
2. Inspect the two independent workflow and pull-request panels. Check links back to real GitHub runs/PRs before making decisions; results cover limited samples and may be empty or delayed.
3. Inspect unknown mergeability, GitHub 403/rate limiting, upstream errors and retry affordances. No failed run can be inferred without a linked source record.
4. Enter an obviously invalid repository string (e.g. `invalid-repo`). The designed contract is HTTP `400` and `Cache-Control: no-store` across the five API routes, with **zero outbound GitHub API request**. Only report this as actually observed after running the local smoke at the exact source SHA.
5. Copy only sanitized, source-linked evidence if needed; never share private repo URLs, tokens or protected headers/screenshots.

For technical reproductions, use injected GitHub fetch mocks and the tests in `tests/`. Do not rely on anonymous real GitHub request quotas for routine CI.

## 4. Small, testable contribution path

1. Search [open issues](https://github.com/senanurcetin/nexus-devops-intelligence/issues) and [existing PRs](https://github.com/senanurcetin/nexus-devops-intelligence/pulls) for overlapping work. Read the issue, owner notes and any release gate; open a short, specific issue if none exists. The [issue chooser](https://github.com/senanurcetin/nexus-devops-intelligence/issues/new/choose) now offers structured public bug/feature forms and a private-security-report link.
2. Choose **one** area: a source-evidence claim, a focused API error-path test, a link/docs correction, one privacy-safe UX fix, or accessibility reproduction.
3. Define before/after and a test that would demonstrate a behavioral defect. Use mocked GitHub API responses and tiny synthetic fixtures; no third-party customer data, private log snippets, real credentials or real quota-stress tests.
4. Make changes to the source and targeted `tests/*.test.mjs`, run `npm test`, `npm run typecheck`, `npm run build`. For Docker changes, follow [issue #81](https://github.com/senanurcetin/nexus-devops-intelligence/issues/81) and provide actual Compose/Windows/Ubuntu evidence. Explicitly mark missing tests `NOT RUN`, not PASS.
5. Open a narrow PR **in this NEXUS repository only when ready**, following any current PR template and describing exact SHA, test commands, failures, user-visible effects and AI assistance honestly. No new upstream third-party PR as part of this Sprint.
6. Handle maintainers' comments without unnecessary empty/trigger commits. Do not change license, deploy, tag, move production aliases, widen rate limits, enable costly runners or request real Redis stress without owner approval.

## 5. Issue reporting and contributor safety

For bugs provide **reproducible** public-only input, expected vs observed result, exact source/version, OS/browser and sanitized errors. A GitHub issue can be visible indefinitely. **Never** publish tokens, private URLs, secret names with values, customer identifiers, protected Preview URLs bearing bypass headers, private logs, local home-directory paths, API payloads with private data, or alleged user/adoption counts.

For security issues follow [SECURITY.md](../SECURITY.md) privately, not a public issue. For feature proposals state a single user decision improved, source truth and non-goals. Community support is volunteer/best-effort unless a separate documented paid contract is in place.

## 6. Source map for new maintainers

| Concern | Current source | Review acceptance |
| --- | --- | --- |
| UI / accessible evidence | `src/app/page.tsx`, `globals.css` | Source link, mobile/browser state, no UI-only false green |
| GitHub fetch and limit/error classification | `src/lib/github-public-client.ts` | Fixed API host, bounded GET, retry/fault matrix |
| Workflow data and trends | `src/lib/github-public-actions.ts`, `nexus-workflow-trends.ts` | Partial/unknown safely differentiated |
| PR mergeability and evidence | `src/lib/nexus-public-prs.ts`, `nexus-pr-evidence.ts` | Draft/unknown/confirmed states disjoint |
| Five API handler entry points | `src/app/api/public-*/route.ts` | 400 before external calls; 429, 503/no-store attribution |
| Local/Redis admission | `src/lib/nexus-public-gate.ts`, `nexus-shared-rate-limit.ts` | No unsafe live stress or fake cross-instance proof |
| Human/browser source QA | `tests/*.test.mjs`, `scripts/manual-browser-f01-f05.mjs` | Exact SHA + actual executed engine; never browser simulation called production verification |
| Proposed Docker acceptance | [draft #80](https://github.com/senanurcetin/nexus-devops-intelligence/pull/80) + [#81](https://github.com/senanurcetin/nexus-devops-intelligence/issues/81) | Loopback/nonroot/image/host/2-OS checks, source-only not sufficient |

## 7. How to earn real first users without invented metrics

- First satisfy the [no-go register](NEXUS_COMMUNITY_RELEASE_DECISION_2026-10-18.md). Keep one tested, copy/paste local install path, documented failure cases and a plain unsupported-feature list.
- Use the project's own public GitHub repos for **three actual, manually recorded** read-only review sessions with before/after decisions and GitHub source links. Empty/not-run sessions do not count.
- Once approved, add one truthful screenshot and an executable walkthrough using only a public sample repo. Do not present staged UI fixtures as real GitHub results.
- Publish release notes/changelog that tie a signed-off tag to full source SHA and image digest; add a clear issues/discussions path and private security reporting.
- Invite voluntary feedback only after a verifiable installation exists; external pilot recruitment is **not a prerequisite** and 0 participants is acceptable.
- Metrics should be retrieved from actual available sources (GitHub Release downloads, actual opt-in issue reports, explicitly measured installations) with date/time and denominators. No telemetry/adoption/user count was available in this Sprint; **unknown is not zero**, and no assumed conversion rate is meaningful.

## 8. Maintainer review checklist

- [ ] Intended scope/issue ownership is clear; no duplicate PR.
- [ ] Exact commit, dependency/lock state and correct branch are recorded.
- [ ] Tests and security gates have **evidence**; failures and NOT RUN are explicit.
- [ ] Code/docs changes do not leak credentials or falsify sampled data.
- [ ] No missing or false Github rate-limit/error handling.
- [ ] Docker tags, ports, run-as-user, nonroot and supply-chain provenance checked when applicable.
- [ ] Version, release notes, rollback and supported OS claims are precise.
- [ ] No Production deployment, expense or license alteration was performed.
- [ ] AI assistance is accurately disclosed and human accountability is maintained.
